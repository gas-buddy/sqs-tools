import assert from 'assert';
import fs from 'fs';
import path from 'path';
import moment from 'moment';
import minimist from 'minimist';
import shortstop from 'shortstop';
import handlers from 'shortstop-handlers';
import { runWithService } from '@gasbuddy/service';
import SqsClient from '@gasbuddy/configured-sqs-client';

const argv = minimist(process.argv.slice(2));

assert(argv.region, 'Missing required "region" argument');
assert(argv.queue, 'Missing required "queue" argument');
assert(argv.template, 'Missing required "template" argument');

runWithService(async (service, req) => {
  req.service = service;
  req.logger = req.gb.logger;
  const config = {
    region: argv.region || process.env.SQS_REGION || 'us-east-1',
    endpoint: argv.endpoint || undefined,
    accountId: argv.accountId || undefined,
    queues: [argv.queue],
  };
  if (argv.key) {
    config.endpoint = {
      endpoint: config.endpoint,
      accessKeyId: argv.key,
      secretAccessKey: argv.secret,
      sessionToken: argv.token,
    };
  }
  const client = new SqsClient(req, config);

  await client.start(req);

  const json = JSON.parse(argv.template[0] === '{' ? argv.template : fs.readFileSync(path.resolve(argv.template), 'utf8'));
  const resolver = shortstop.create();
  resolver.use(handlers.env());
  resolver.use(handlers.base64());
  resolver.use(handlers.exec());
  resolver.use('now', value => moment().format(value));
  resolver.use('relative-date', (value) => {
    const [amount, interval, ...format] = value.split(' ');
    const finalFormat = format.join(' ');
    return moment().add(amount, interval).format(finalFormat);
  });

  const message = await new Promise((accept, reject) => {
    resolver.resolve(json, (error, data) => {
      if (error) {
        reject(error);
      } else {
        accept(data);
      }
    });
  });

  try {
    req.gb.logger.info('Publishing message', message);
    await client.publish(req, argv.queue, message, { correlationid: req.headers.correlationid });
  } catch (error) {
    req.gb.logger.error('Failed to publish', req.gb.wrapError(error));
    process.exitCode = -1;
  } finally {
    await client.stop(req);
  }
});
