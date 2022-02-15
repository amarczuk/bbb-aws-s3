#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const AWS = require("aws-sdk");
const glob = require('glob');
const mime = require('mime-types');

const client = new AWS.S3({ apiVersion: '2006-03-01', region: process.env.AWS_REGION});
const folder = process.env.BBB_PUBLISH_FOLDER || '/var/bigbluebutton/published/presentation/';
const statusFolder = process.env.BBB_STATUS_FOLDER || '/var/bigbluebutton/recording/status/published/';
const remove = process.env.BBB_PUBLISH_DELETE || false;
const useLock = process.env.BBB_USE_LOCK || false;
const keepMeta = process.env.BBB_KEEP_META || false;
const lockPath = path.join(os.tmpdir(), 'bbb-s3.lock');

const addDate = function(msg) {
    const d = new Date();
    const datestring = d.getFullYear() + "-" +
        (d.getMonth() + 1).toString().padStart(2, '0') + "-" +
        d.getDate().toString().padStart(2, '0') + " " +
        d.getHours().toString().padStart(2, '0') + ":" +
        d.getMinutes().toString().padStart(2, '0') + ':' +
        d.getSeconds().toString().padStart(2, '0') + '.' +
        d.getMilliseconds().toString().padStart(3, '0');
    return datestring + '\t\t' + msg;
}

const log = function(msg) {
    console.log(addDate(msg));
}

const error = function (msg) {
    console.error(addDate('Error: ' + msg));
}

if (process.argv.indexOf('-f') != -1 && fs.existsSync(lockPath)) {
    fs.unlinkSync(lockPath);
}

if (useLock) {
    if (fs.existsSync(lockPath)) {
        error('Lock file (/tmp/bbb-s3.lock) created by another process');
        process.exit(1);
    }

    fs.writeFileSync(lockPath, 'locked');
}

log('Reading file list...');

const allFiles = glob.sync('**/*', {
    mark: true,
    cwd: folder
});

let cnt = 0;

const doneCache = {};
const isDone = function(file) {
    const rest = file.replace(folder, '');
    const id = rest.split('/')[0] || '';

    if (!id) return false;
    if (doneCache[id] !== undefined) return doneCache[id];

    doneCache[id] = fs.existsSync(path.join(statusFolder, id + '-presentation.done'));
    return doneCache[id];
}

const batch = function() {
    const forUpload = [];
    const files = allFiles.slice(cnt, cnt + 100);

    files.forEach(function(file) {
        cnt++;

        // skip folders
        if (file[file.length - 1] == '/') return;

        // check if published status is created
        if (!isDone(file)) {
            log(file + ' not published');
            return;
        }

        const cmd = client.headObject({
            Bucket: process.env.BBB_PUBLISH_BUCKET,
            Key: file,
        }).promise()
            .then(function(data) {
                log('skipping: ' + file);
                return false;

            })
            .catch(function(e) {
                log('saving: ' + file);
                const name = path.basename(file);
                const type = mime.contentType(name);
                const options = {
                    Bucket: process.env.BBB_PUBLISH_BUCKET,
                    Key: file,
                    Body: fs.createReadStream(folder + file),
                    ACL: 'public-read',
                };
                if (type) options.ContentType = type;
                return client.putObject(options).promise();
            })
            .then(function(d) {
                const name = path.basename(file);
                const type = mime.contentType(name);
                const keep = type === 'application/xml' && keepMeta;

                if (remove && !keep) {
                    log('deleting: ' + file);
                    try {
                        fs.unlinkSync(folder + file);
                    } catch(e) {
                        error(e);
                    }
                }
            });

        log('queuing ' + file);
        forUpload.push(cmd);
    });

    if (cnt >= allFiles.length && !forUpload.length) {
        log('all done');
        return true;
    }

    return Promise.all(forUpload)
        .then(function(results) {
            return batch();
        })
        .catch(function(e) {
            console.log(e);
        });
};

Promise.all([batch()])
    .then(function (results) {
        log('no errors');
        if (useLock && fs.existsSync(lockPath)) {
            fs.unlinkSync(lockPath);
        }
    })
    .catch(function (e) {
        log(e);
        if (useLock && fs.existsSync(lockPath)) {
            fs.unlinkSync(lockPath);
        }
    });