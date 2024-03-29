import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import app from '../app';
import db from '../db';
import data from './data.json';

const sendMailMock = jest.fn();
jest.mock('nodemailer');
const nodemailer = require('nodemailer');
nodemailer.createTransport.mockReturnValue({
  sendMail: sendMailMock,
  verify: jest.fn(),
});

let auth: any;
describe('Record Tests', () => {
  beforeAll(async () => {
    sendMailMock.mockClear();
    nodemailer.createTransport.mockClear();
    const signupResponse = await request(app)
      .put('/api/user/signup')
      .send(data.userSignup)
    expect(signupResponse.status).toEqual(200);
    expect(sendMailMock).toHaveBeenCalled();
    const userRecord = await db.Record.findOne({
      object: 'user',
      'data.email': data.userLogin.email,
    });
    await db.Record.updateOne(
      { _id: userRecord.data.userId },
      {
        'data.emailVerified': true,
        'data.approved': true,
        'data.role': 'Designer'
      }
    )
    expect(userRecord.data.email).toEqual(data.userLogin.email);
    const loginResponse = await request(app)
      .post('/api/user/authenticate')
      .send(data.userLogin)
    auth = loginResponse.body;
    expect(loginResponse.status).toEqual(200)
    const createPaymentObject = await request(app)
      .post(`/api/admin/${auth.userId}/create-object`)
      .set('Authorization', `Bearer ${auth.jwtToken}`)
      .send(data.paymentObject)
    console.log('createPaymentObject: ', createPaymentObject.body);
    expect(createPaymentObject.status).toEqual(200);
  })
  it('Create Record', async () => {
    const createRecordResponse = await request(app)
      .post(`/api/${auth.userId}/create-record`)
      .set('Authorization', `Bearer ${auth.jwtToken}`)
      .send(data.createRecord);
    console.log('createRecordResponse: ', createRecordResponse.error);
    expect(createRecordResponse.status).toEqual(200)
    const payment = await db.Record.findOne({ object: 'payment' });
    expect(payment.data.invoice_no).toEqual(358);
  });
  // it('Get records for list', async () => {
  //   const createRecord2Response = await request(app)
  //     .post(`/api/${auth.userId}/create-record`)
  //     .set('Authorization', `Bearer ${auth.jwtToken}`)
  //     .send(data.createRecord2);
  //   console.log('createRecord2Response: ', createRecord2Response.error);
  //   expect(createRecord2Response.status).toEqual(200)
  //   const getRecordsForListResponse = await request(app)
  //     .post(`/api/${auth.userId}/get-records-for-list`)
  //     .set('Authorization', `Bearer ${auth.jwtToken}`)
  //     .send({ list: })
  // });
});
