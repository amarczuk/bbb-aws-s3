# BBB-AWS-S3

Copies published media from Big Blue Button server to AWS S3 bucket

```bash
npm i bbb-aws-s3
node archive.js
node archive.js -f //delete existing lockfile
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
BBB_PUBLISH_FOLDER==/var/bigbluebutton/published/presentation/
BBB_PUBLISH_BUCKET=(bucket name)
BBB_USE_LOCK=(true - allow only one process at a time)
BBB_PUBLISH_DELETE=(true - delete files when in s3 bucket)
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

Create CRON job to run the archive script every 5 minutes