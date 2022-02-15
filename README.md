# BBB-AWS-S3

Moves published media recordings from Big Blue Button server to AWS S3 bucket

```bash
npm i -g bbb-aws-s3
bbb-archive
bbb-archive -f // ignore existing lockfile
```

## S3 configuration
Allow internet read access to the bucket.

Set CORS policy to:
```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "HEAD"
        ],
        "AllowedOrigins": [
            "*"
        ],
        "ExposeHeaders": []
    }
]
```

## Environment setup
```bash
AWS_ACCESS_KEY_ID=(aws access key)
AWS_SECRET_ACCESS_KEY=(aws secret)
AWS_REGION=(aws region)
BBB_PUBLISH_FOLDER=/var/bigbluebutton/published/presentation/ (default)
BBB_STATUS_FOLDER=/var/bigbluebutton/recording/status/published/ (default)
BBB_PUBLISH_BUCKET=(bucket name)
BBB_USE_LOCK=(true - allow only one process at a time) (default=false)
BBB_PUBLISH_DELETE=(true - delete files when in s3 bucket) (default=fase)
BBB_KEEP_META=(true - keep xml files) (default=fase)
```

## Changes in BBB code

Edit `/var/bigbluebutton/playback/presentation/2.0/lib/writing.js` and replace
```js
function getFullURL() {
  let url = '/presentation/' + meetingId;
  return url;
};
```
with
```js
function getFullURL() {
  let url = 'https://[bucket-name].s3.[region].amazonaws.com/' + meetingId;
  return url;
};
```

## Running on the BBB server

Create CRON job to run the archive script every 5 minutes.

Run:

```bash
crontab -e
```

Add:

```
*/5 * * * * bbb-archive >> /var/log/bbb-archive.log
```

It will create lock file to prevent running again if previous job is still in progress.

If job fails before lock is removed run:
```bash
bbb-archive -f
```
