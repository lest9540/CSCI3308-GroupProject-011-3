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

// *********************** User Register Page Test Cases **************************

// ********************************************************************************

// const html_start_regex = /^<!DOCTYPE html>.*/;
// const html_end_regex = /.*<\/html>$/;

// Test cases for /register API, positive and negative
let check = undefined;
const login_regex = /.*Login Page.*/
describe('Testing Register User API', () => {
    it('positive : /register', done => {
      console.log('before chai');
      chai
        .request(server)
        .post('/register')
        .send({name: 'John_Doe', password: 'scoobydoo', email: 'lest9540@colorado.edu'})
        .end((err, res) => {
          console.log(res.text);
          expect(res).to.have.status(200);
          check = login_regex.test(res.text);
          assert(check == true);
          done();
        });
      });
      console.log('after chai');

    it('Negative : /register. Checking invalid name', done => {
      chai
        .request(server)
        .post('/register')
        .send({name: undefined, password: 'DuckTales', email: 'geba6807@colorado.edu'})
        .end((err, res) => {
          expect(res).to.have.status(400);
          done();
        });
    });
  });



// ***************** Redirect/Render Test Cases ***********************

// ********************************************************************************

// Testing for Redirect
const login_redirect_regex = /^127\.0\.0\.1.*\/login/
describe('Testing Redirect', () => {
  it('Positive : redirect to /login', done => {
    chai
      .request(server)
      .get('/test')
      .end((err, res) => {
        check = login_regex.test(res.text);
        res.should.have.status(200); // Expecting a success status code
        done();
      });
  });
});


// Testing for Render
describe('Testing Render', () => {
  it('Positive : /login route', done => {
    chai
      .request(server)
      .get('/login') // for reference, see lab 8's login route (/login) which renders home.hbs
      .end((err, res) => {
        res.should.have.status(200); // Expecting a success status code
        res.should.be.html; // Expecting a HTML response
        done();
      });
  });
});