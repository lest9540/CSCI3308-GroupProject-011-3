// ********************** Initialize server **********************************

const server = require('../index'); //TODO: Make sure the path to your index.js is correctly added

// ********************** Import Libraries ***********************************

const chai = require('chai'); // Chai HTTP provides an interface for live integration testing of the API's.
const chaiHttp = require('chai-http');
const { restart } = require('nodemon');
chai.should();
chai.use(chaiHttp);
const {assert, expect} = chai;

// ********************** DEFAULT WELCOME TESTCASE ****************************

describe('Server!', () => {
  // Sample test case given to test / endpoint.
  it('Returns the default welcome message', done => {
    chai
      .request(server)
      .get('/welcome')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.status).to.equals('success');
        assert.strictEqual(res.body.message, 'Welcome!');
        done();
      });
  });
});

// *********************** TODO: WRITE 2 UNIT TESTCASES **************************

// ********************************************************************************

const html_start_regex = /^<!DOCTYPE html>.*/;
const html_end_regex = /.*<\/html>$/;

const register_regex = /.*<form action=.* method=.*>.*/
describe('Testing Register User API', () => {
    it('positive : /register', done => {
      chai
        .request(server)
        .post('/register')
        .send({username: 'John Doe', password: 'scoobydoo'})
        .end((err, res) => {
          expect(res).to.have.status(200);
          check = (html_start_regex.test(res.text) && html_end_regex.test(res.text) && register_regex.test(res.text))
          assert(check == true);
          done();
        });
    });

    it('Negative : /register. Checking invalid name', done => {
      chai
        .request(server)
        .post('/register')
        .send({username: undefined, password: 'scoobydoo'})
        .end((err, res) => {
          expect(res).to.have.status(400);
          console.log("\nres.text:\n" + res.text + "\n");
          done();
        });
    });
  });