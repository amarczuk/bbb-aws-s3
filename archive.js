require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const glob = require('glob');

const client = new S3Client({region: 'eu-west-2'});
const folder = process.env.BBB_PUBLISH_FOLDER;
const remove = process.env.BBB_PUBLISH_DELETE || false;
const useLock = process.env.BBB_USE_LOCK || false;
const lockPath = path.join(os.tmpdir(), 'bbb-s3.lock');

if (!folder) {
    console.error('No BBB folder');
    process.exit(1);
}

const allFiles = glob.sync('**/*', {
    mark: true,
    cwd: folder
});

let cnt = 0;

const batch = function() {
    const forUpload = [];
    const files = allFiles.slice(cnt, cnt + 100);

    files.forEach(function(file) {
        cnt++;

        // skip folders
        if (file[file.length - 1] == '/') return;
        const head = new HeadObjectCommand({
            Bucket: process.env.BBB_PUBLISH_BUCKET,
            Key: file,
        });

        const put = new PutObjectCommand({
            Bucket: process.env.BBB_PUBLISH_BUCKET,
            Key: file,
            Body: fs.createReadStream(folder + file),
        });

        const cmd = client
            .send(head)
            .then(function(data) {
                console.log('skipping: ' + file);
                return false;
            })
            .catch(function(e) {
                console.log('saving: ' + file);
                return client.send(put);
            })
            .then(function(d) {
                if (remove) {
                    console.log('deleting: ' + file);
                    try {
                        fs.unlinkSync(file);
                    } catch(e) {
                        console.error(e);
                    }
                }
            });

        console.log('queuing ' + file);
        forUpload.push(cmd);
    });

    if (cnt >= allFiles.length && !forUpload.length) {
        console.log('all done');
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

if (useLock) {
    if (fs.existsSync(lockPath)) {
        console.error('Lock file (/tmp/bbb-s3.lock) created by another process');
        process.exit(1);
    }

    fs.writeFileSync(lockPath, 'locked');
}

Promise.all([batch()])
    .then(function (results) {
        console.log('no errors');
    })
    .catch(function (e) {
        console.log(e);
    })
    .finally(function() {
        if(useLock && fs.existsSync(lockPath)) {
            fs.unlinkSync(lockPath);
        }
    });