import tap from 'tap';
import { exec } from 'child_process';

const host = process.env.SQS_HOST || 'localhost';
const port = process.env.SQS_PORT || 9324;

tap.test('test_publish', (t) => {
  const proc = exec([
    'node -r @babel/register ./src/publish-sqs-message.js',
    '--key=key --secret=secret --token=token',
    `--region=us-east-1 --queue=basic_queue --endpoint=http://${host}:${port}/queue`,
    '--template=\'{"start": "relative-date:-4 days YYYY-MM-DD"}\'',
  ].join(' '), (err, stdout, stderr) => {
    console.log(stdout);
    console.error(stderr);
    console.error(err);
    if (err) {
      t.fail(err.message);
    }
  });
  proc.on('exit', (code) => {
    t.strictEquals(code, 0, 'Should exit successfully');
    t.end();
  });
});
