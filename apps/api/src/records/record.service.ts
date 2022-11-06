import mongoose from 'mongoose';
import _ from 'underscore';

import db from '../db';
import objectService from '../objectDictionary/objectDictionary.service';

import { PlatformRecord } from './record.model';

async function createRecord(record: PlatformRecord) {
  const objectInfo = await db.ObjectDictionary.findOne({ name: record.object });
  const uniqueFields = [];
  _.each(objectInfo.fields, (field) => {
    if (field.unique === true) {
      uniqueFields.push(field.name);
    }
  });

  const data = {
    _id: new mongoose.Types.ObjectId(),
    object: record.object,
    data: record.data,
    createdAt: new Date().toISOString(),
  };
  // todo: uncomment when done
  const create = await db.Record.create(data);
  if (create) {
    return create;
  }
  return false;
}

async function updateRecord(payload: any, user: { id: any }) {
  const now = new Date().toISOString();
  const pay = { ...payload };
  pay.data.updated_by = user.id;
  pay.data.updated_at = now;
  return db.Record.findOneAndUpdate({ _id: pay.id }, { data: pay.data });
}

async function getAllRecords() {
  return db.Record.find();
}

async function autoIncrementField(objectName: any, fieldName: string | number) {
  const record = await db.Record.find({ object: objectName }).sort({
    [fieldName]: -1,
  });
  let selectedRecord = {};
  let selectedVal = 0;
  for (let i = 0; i < record.length; i++) {
    if (record[i].data[fieldName] > selectedVal) {
      selectedVal = record[i].data[fieldName];
      selectedRecord = record[i];
    }
  }
  return selectedRecord;
}

async function getRecordsByObject(payload: any) {
  let records = [];
  if (payload.conditions && payload.conditions[0].lhs !== '') {
    const key = `data.${payload.conditions[0].lhs}`;
    if (payload.conditions[0].rhs.type === 'literal') {
      const val = payload.conditions[0].rhs.value;
      records = await db.Record.find({
        object: payload.object,
        [key]: `${val}`,
      });
    }
  } else {
    records = await db.Record.find({ object: payload.object });
  }
  return records;
}

async function getRecordByObjectAndField(payload: {
  object: any;
  field: any;
  value: any;
}) {
  const { object, field, value } = payload;
  const records = await db.Record.find({ object });
  let record = false;
  _.each(records, (rec) => {
    if (Array.isArray(rec.data[field])) {
      _.each(rec.data[field], (item) => {
        if (item === value) {
          record = rec;
        }
      });
    } else if (rec.data[field] === value) {
      record = rec;
    }
  });
  return record;
}

async function getRecordByObjectID(payload: { id: any }) {
  const { id } = payload;
  return db.Record.find({ _id: id });
}

function evaluateRhs(
  operand: { type: string; systemField: string; field: string | number },
  system: {
    account: { id: any };
    user: { userId: any };
    account_member: { id: any };
  },
  input: { [x: string]: any }
) {
  if (operand.type === 'system') {
    if (operand.systemField === 'logged_in_account') {
      return system.account.id;
    }

    if (operand.systemField === 'logged_in_user') {
      return system.user.userId;
    }

    if (operand.systemField === 'logged_in_account_member') {
      return system.account_member.id;
    }
  } else if (operand.type === 'input') {
    return input[operand.field];
  }
  return false;
}

function evaluateLhs(
  operand: { name: string | number },
  record: { data: { [x: string]: any } }
) {
  if (record.data[operand.name]) {
    return record.data[operand.name];
  }
  return false;
}

async function filterRecords(
  objectName: any,
  records: any,
  filter: { meta: any },
  system: {
    account: { id: any };
    user: { userId: any };
    account_member: { id: any };
  },
  input: { [x: string]: any }
) {
  const { meta } = filter;
  const filteredRecords: any[] = [];
  const { lhs, rhs, operator } = meta.conditions[0];
  // check what is on lhs
  const right = evaluateRhs(rhs, system, input);
  const lhsObject = await objectService.getObjectByName({ name: objectName });
  const lhsField = _.findWhere(lhsObject.fields, { name: lhs.field });
  _.each(records, (record) => {
    const left = evaluateLhs(lhsField, record);
    switch (operator) {
      case '=':
      case '==':
      case '===':
        if (left === right) filteredRecords.push(record);
        break;
      default:
        break;
    }
  });
  return filteredRecords;
}

async function getRecordByName(payload: { name: any }) {
  return db.Record.find({ 'data.name': payload.name });
}

async function getRecordsByObjectFieldsWithConditions(payload: {
  conditions: { operator: string };
}) {
  if (payload.conditions.operator === '==') {
    // const filter = await db.Record.find({
    //   payload.conditions.lhs :
    // })
  }
}

async function getRecordsByObjectFields(payload: { object: any; fields: any }) {
  const records = await db.Record.find({ object: payload.object });
  const fields = _.pluck(payload.fields, 'name');
  return _.map(records, (record) => {
    const item = {};
    _.each(fields, (field) => {
      if (record.data !== undefined) {
        // @ts-ignore
        item[field] = record.data[field];
      }
    });
    return item;
  });
}

async function getAvg(records: any, name: string) {
  const data: any[] = [];
  _.each(records, (record) => {
    if (name in record) {
      data.push(record[name]);
    }
  });
  const sum = _.reduce(data, (memo, num) => memo + num, 0);
  const count = Object.keys(data).length;
  return parseFloat((sum / count).toFixed(2));
}

async function getCount(records: any, name: string | number) {
  const data: any[] = [];
  _.each(records, (record) => {
    data.push(record[name]);
  });
  const unique = _.uniq(data);
  const arr = {};
  _.each(records, (record) => {
    _.each(unique, (item) => {
      if (item === record[name]) {
        // @ts-ignore
        if (!arr[record[name]]) {
          // @ts-ignore
          arr[record[name]] = 0;
        }
        // @ts-ignore
        arr[record[name]]++;
      }
    });
  });
  return arr;
}

async function getMin(records: any, name: string) {
  const data: any[] = [];
  _.each(records, (record) => {
    if (name in record) {
      data.push(record[name]);
    }
  });
  return _.min(data);
}

async function getMax(records: any, name: string) {
  const data: any[] = [];
  _.each(records, (record) => {
    if (name in record) {
      data.push(record[name]);
    }
  });
  return _.max(data);
}

async function getSum(records: any, name: string) {
  const data: any[] = [];
  _.each(records, (record) => {
    if (name in record) {
      data.push(record[name]);
    }
  });
  return _.reduce(data, (memo, num) => memo + num, 0);
}

async function getGroupByDate(records: any, name: string) {
  const data: any[] = [];
  _.each(records, (record) => {
    if (name in record) {
      if (record[name] !== undefined) {
        data.push(record[name].split('T')[0]);
      }
    }
  });
  const unique = _.uniq(data);
  let arr = {};
  _.each(records, (record) => {
    _.each(unique, (item) => {
      if (item !== undefined && record[name] !== undefined) {
        if (item.split('T')[0] === record[name].split('T')[0]) {
          // @ts-ignore
          if (!arr[record[name].split('T')[0]]) {
            // @ts-ignore
            arr[record[name].split('T')[0]] = 0;
          }
          // @ts-ignore
          arr[record[name].split('T')[0]]++;
        }
      }
    });
  });
  // eslint-disable-next-line no-param-reassign,no-sequences,no-return-assign
  // @ts-ignore
  // prettier-ignore
  // eslint-disable-next-line no-sequences, no-return-assign, no-param-reassign
  const sortObject = (o) => Object.keys(o).sort().reduce((r, k) => ((r[k] = o[k]), r), {});
  arr = sortObject(arr);
  return arr;
}

export default {
  createRecord,
  getAllRecords,
  getRecordsByObject,
  getRecordsByObjectFields,
  getRecordByObjectID,
  getAvg,
  getCount,
  getMin,
  getMax,
  getSum,
  getGroupByDate,
  getRecordsByObjectFieldsWithConditions,
  updateRecord,
  getRecordByName,
  filterRecords,
  getRecordByObjectAndField,
  autoIncrementField,
};