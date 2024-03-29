import _ from 'underscore';

import designService from '../designs/design.service';
import processService from '../processes/process.service';

async function preCreateRecord(record: { object: any, data: any }) {
  const events = await designService.getDesignsByType({ type: 'event' });
  const filteredEvents: any[] = [];
  _.each(events, (event) => {
    if (
      event.meta.object === record.object &&
      event.meta.type === 'Pre-Create Record'
    ) {
      console.log('record.object: ', record.object);
      console.log('event.meta.object: ', event.meta.object);
      filteredEvents.push(event);
    }
  });
  for (let i = 0; i < filteredEvents.length; i++) {
    const event = filteredEvents[i];
    if (event.meta.process) {
      const process = await processService.getProcessByName(event.meta.process);
      if (process) {
        // find the input of same object as record
        // @ts-ignore
        // put the data in the pool as an input
        let { pool } = process.meta;
        pool = _.map(pool, (variable) => {
          if (variable.feeder === 'input') {
            if (variable.object === record.object) {
              return {
                ...variable,
                data: record.data
              }
            }
          }
          return variable;
        });

        const val = await processService.runProcess(process, pool);
        return !val;
      }
    }
  }
  return true;
}

async function postCreateRecord(record: { object: any, data: any }) {
  const events = await designService.getDesignsByType({ type: 'event' });
  const filteredEvents: any[] = [];
  _.each(events, (event) => {
    if (
      event.meta.object === record.object &&
      event.meta.type === 'Create Record'
    ) {
      filteredEvents.push(event);
    }
  });
  for (let i = 0; i < filteredEvents.length; i++) {
    const event = filteredEvents[i];
    if (event.meta.process) {
      const process = await processService.getProcessByName(event.meta.process);
      if (process) {
        // find the input of same object as record
        // @ts-ignore
        // put the data in the pool as an input
        let { pool } = process.meta;
        pool = _.map(pool, (variable) => {
          if (variable.feeder === 'input') {
            if (variable.object === record.object) {
              return {
                ...variable,
                data: record.data
              }
            }
          }
          return variable;
        });
        await processService.runProcess(process, pool);
      }
    }
  }
  return true;
}

export default {
  postCreateRecord,
  preCreateRecord,
};

/**
 * todo : redo filters in the frontend with conditions2
 * add filter controller and service in backend
 * redo list read and handle filters + action conditions in backend + sort
 * fix and test new list read
 * recreate old filters
 * tare down old filters
 *mmat
 * recreate old processes
 * tare down old processes
 * tare down old conditions
 */
