const mocha = require('mocha');
const should = require('should');
const Serializer = require('../src/serializer');

const Serializers = require('../src/serializer.js')
const Base = Serializers.BaseSerializer
const Vst = Serializers.VstSerializer
const Notes = Serializers.NotesSerializer

describe('serializer', function() {

  const serializer = new Serializers.TestsSerializer();

  describe('object rule', function() {    
    // TODO: Check if reaper ever puts objects one line
    it('should dump a one line object', function() {
      new Base({
          token: 'TEST',
          params: [1],
          contents: [],
      }).dump().should.equal('<TEST 1\n>');
    });

    it('should dump a multiline object with two structs', function() {
      new Base({
          token: 'NAME',
          params: ['GUITAR'],
          contents: [
            {token: 'VOLUME', params: [11]},
          ],
      }).dump().should.equal(`<NAME GUITAR\n  VOLUME 11\n>`);
    });

    it('should dump a multiline object with two structs and an object', function() {
      new Base({
          token: 'NAME',
          params: ['GUITAR'],
          contents: [
            {token: 'VOLUME', params: [11]},
            new Base({
              token: 'METRONOME',
              params: [6, 2],
              contents: [
                {token: 'VOL', params: [0.25, 0.125]},
              ]
            }),
          ],
      }).dump().should.equal(`<NAME GUITAR\n  VOLUME 11\n  <METRONOME 6 2\n    VOL 0.25 0.125\n  >\n>`);
    });
  }); // Describe object Rule

  describe('int rule', function() {
    // To use a custom 'startRule', you must add it to the switch statement in TestsSerializer
    const dump = input => serializer.dump(input, {startRule: 'int'});

    it('should dump 0', function() { dump(0).should.equal('0'); });
    it('should dump 100', function() { dump(100).should.equal('100'); });
    it('should dump negative integers', function() { dump(-10).should.equal('-10'); });
  }) // Describe int rule

  describe('decimal rule', function() {
    // To use a custom 'startRule', you must add it to the switch statement in TestsSerializer
    const dump = input => serializer.dump(input, {startRule: 'decimal'});

    it('should dump 0.0', function() { dump(0.0).should.equal('0'); });
    it('should dump 0.5', function() { dump(0.5).should.equal('0.5'); });
    it('should dump 101.555', function() { dump(101.555).should.equal('101.555'); });
    it('should dump negative integers', function() { dump(-10.1234).should.equal('-10.1234'); });
  }) // Describe decimal rule

  describe('params rule', function() {
    // To use a custom 'startRule', you must add it to the switch statement in TestsSerializer
    const dump = input => serializer.dump(input, {startRule: 'params'});

    const t01 = [0, 1];
    it(`should dump "${t01}" as two ints`, function() {
      dump(t01).should.equal(' 0 1');
    });

    const t02 = [5, 10];
    it(`should dump "${t02}" as two ints`, function() {
      dump(t02).should.equal(' 5 10');
    });

    const t03 = ['ok', 1, 2, 3];
    it(`should dump "${t03}" as a string and three ints`, function() {
      dump(t03).should.equal(' ok 1 2 3');
    });

    const t04 = ['', '1234{}'];
    it(`should dump "${t04}" as an empty string and a string that starts with an integer`, function() {
      dump(t04).should.equal(' "" 1234{}');
    });
  }); // describe params

  describe('string rule', function() {
    // To use a custom 'startRule', you must add it to the switch statement in TestsSerializer
    const dump = input => serializer.dump(input, {startRule: 'string'});

    it('should dump strings', function() {
      dump('Okay this is a string').should.equal('"Okay this is a string"');
      dump('').should.equal('""');
    });

    it('should handle non-alphanumeric characters', function() {
      dump('! ok').should.equal('"! ok"');
      dump('ok !').should.equal('"ok !"');
      dump('!@#$%^&*()_+').should.equal('!@#$%^&*()_+');
    });

    it('should handle strings beginning with quotes', function() {
      dump(`''`).should.equal(`"''"`);
      dump(`'"'`).should.equal(`\`'"'\``);
      dump('```').should.equal('"```"');
      dump('"').should.equal(`'"'`);
      dump(`'"`).should.equal(`\`'"\``);
    });

  }); // describe string rule


  describe('multiline parameters', function() {

    it('should dump NOTES objects', function() {
      new Notes({
          token: 'NOTES',
          params: ['| Line one with extra pipes |\n Second Line'],
          contents: [],
      }).dump().should.equal('<NOTES\n  || Line one with extra pipes |\n  | Second Line\n>')
    });

    it('should dump strings that start with a string delimiter and contain all delimiters', () => {
      new Base({
          token: 'NAME',
          params: [`'''\`\`\`"""`,],
          contents: [],
      }).dump().should.equal(`<NAME \`''''''"""\`\n  <NAME\n    |'''\`\`\`"""\n  >\n>`);
    });

    it('should dump VSTs/Plugins containing Base64', function() {
      new Vst({
          token: 'VST',
          params: ['VST3: #TStereo Delay (Tracktion)', '#TStereo Delay.vst3', 0, '', '1997878177{5653545344656C237473746572656F20}', '',
                  `oTMVd+9e7f4CAAAAAQAAAAAAAAACAAAAAAAAAAIAAAABAAAAAAAAAAIAAAAAAAAAEgUAAAEAAAD//xAA`,
                  `AgUAAAEAAABWc3RXAAAACAAAAAEAAAAAQ2NuSwAABOpGQkNoAAAAAlNEZWwAAQAmAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEUlBST0dSQU0AAQRwbHVnaW5JRAABDwVUU3RlcmVvIERlbGF5AHByb2dyYW1EaXJ0eQABAQNjdXJyZW50UHJvZ3JhbQABEQVGYWN0b3J5IERlZmF1bHQAcHJvZ3JhbUlEAAABF1BBUkFNAAECaWQAAQsFZGVsYXlzeW5jAHZhbHVlAAEJBAAAAAAAAPA/AFBBUkFNAAECaWQAAQcFZHJ5ZGIAdmFsdWUAAQkEAAAAAAAARMAAUEFSQU0AAQJpZAABCAVlbmFibGUAdmFsdWUAAQkEAAAAAAAA8D8AUEFSQU0AAQJpZAABBwVpbnB1dAB2YWx1ZQABCQQAAAAAAAAAAABQQVJBTQABAmlkAAEQBWxjcm9zc2ZlZWRiYWNrAHZhbHVlAAEJBAAAAAAAAAAAAFBBUkFNAAECaWQAAQoFbGRlbGF5bXMAdmFsdWUAAQkEAAAAAABAf0AAUEFSQU0AAQJpZAABDAVsZGVsYXlub3RlAHZhbHVlAAEJBAAAAAAAAAhAAFBBUkFNAAECaWQAAQ4FbGRlbGF5b2Zmc2V0AHZhbHVlAAEJBAAAAAAAAPA/AFBBUkFNAAECaWQAAQsFbGZlZWRiYWNrAHZhbHVlAAEJBAAAAAAAAD5AAFBBUkFNAAECaWQAAQoFbGhpZ2hjdXQAdmFsdWUAAQkEAAAAAACI00AAUEFSQU0AAQJpZAABCQVsbG93Y3V0AHZhbHVlAAEJBAAAAAAAADRAAFBBUkFNAAECaWQAAQYFbHBhbgB2YWx1ZQABCQQAAAAAAADwvwBQQVJBTQABAmlkAAEJBWxzb3VyY2UAdmFsdWUAAQkEAAAAAAAA8D8AUEFSQU0AAQJpZAABEAVyY3Jvc3NmZWVkYmFjawB2YWx1ZQABCQQAAAAAAAAAAABQQVJBTQABAmlkAAEKBXJkZWxheW1zAHZhbHVlAAEJBAAAAAAAQH9AAFBBUkFNAAECaWQAAQwFcmRlbGF5bm90ZQB2YWx1ZQABCQQAAAAAAAAIQABQQVJBTQABAmlkAAEOBXJkZWxheW9mZnNldAB2YWx1ZQABCQQAAAAAAADwPwBQQVJBTQABAmlkAAELBXJmZWVkYmFjawB2YWx1ZQABCQQAAAAAAAA+QABQQVJBTQABAmlkAAEKBXJoaWdoY3V0AHZhbHVlAAEJBAAAAAAAiNNAAFBBUkFNAAECaWQAAQkFcmxvd2N1dAB2YWx1ZQABCQQAAAAAAAA0QABQQVJBTQABAmlkAAEGBXJwYW4AdmFsdWUAAQkEAAAAAAAA8D8AUEFSQU0AAQJpZAABCQVyc291cmNlAHZhbHVlAAEJBAAAAAAAAABAAFBBUkFNAAECaWQAAQcFd2V0ZGIAdmFsdWUAAQkEAAAAAAAAJMAAAAAAAAAAAABKVUNFUHJpdmF0ZURhdGEAAQFCeXBhc3MAAQEDAB0AAAAAAAAASlVDRVByaXZhdGVEYXRhAAAAAAAAAAA=`,
                  `AEZhY3RvcnkgUHJlc2V0czogRmFjdG9yeSBEZWZhdWx0ABAAAAA=`],
          contents: [],
      }).dump().should.deepEqual(`<VST "VST3: #TStereo Delay (Tracktion)" "#TStereo Delay.vst3" 0 "" 1997878177{5653545344656C237473746572656F20} ""
  oTMVd+9e7f4CAAAAAQAAAAAAAAACAAAAAAAAAAIAAAABAAAAAAAAAAIAAAAAAAAAEgUAAAEAAAD//xAA
  AgUAAAEAAABWc3RXAAAACAAAAAEAAAAAQ2NuSwAABOpGQkNoAAAAAlNEZWwAAQAmAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEUlBST0dSQU0A
  AQRwbHVnaW5JRAABDwVUU3RlcmVvIERlbGF5AHByb2dyYW1EaXJ0eQABAQNjdXJyZW50UHJvZ3JhbQABEQVGYWN0b3J5IERlZmF1bHQAcHJvZ3JhbUlEAAABF1BBUkFN
  AAECaWQAAQsFZGVsYXlzeW5jAHZhbHVlAAEJBAAAAAAAAPA/AFBBUkFNAAECaWQAAQcFZHJ5ZGIAdmFsdWUAAQkEAAAAAAAARMAAUEFSQU0AAQJpZAABCAVlbmFibGUA
  dmFsdWUAAQkEAAAAAAAA8D8AUEFSQU0AAQJpZAABBwVpbnB1dAB2YWx1ZQABCQQAAAAAAAAAAABQQVJBTQABAmlkAAEQBWxjcm9zc2ZlZWRiYWNrAHZhbHVlAAEJBAAA
  AAAAAAAAAFBBUkFNAAECaWQAAQoFbGRlbGF5bXMAdmFsdWUAAQkEAAAAAABAf0AAUEFSQU0AAQJpZAABDAVsZGVsYXlub3RlAHZhbHVlAAEJBAAAAAAAAAhAAFBBUkFN
  AAECaWQAAQ4FbGRlbGF5b2Zmc2V0AHZhbHVlAAEJBAAAAAAAAPA/AFBBUkFNAAECaWQAAQsFbGZlZWRiYWNrAHZhbHVlAAEJBAAAAAAAAD5AAFBBUkFNAAECaWQAAQoF
  bGhpZ2hjdXQAdmFsdWUAAQkEAAAAAACI00AAUEFSQU0AAQJpZAABCQVsbG93Y3V0AHZhbHVlAAEJBAAAAAAAADRAAFBBUkFNAAECaWQAAQYFbHBhbgB2YWx1ZQABCQQA
  AAAAAADwvwBQQVJBTQABAmlkAAEJBWxzb3VyY2UAdmFsdWUAAQkEAAAAAAAA8D8AUEFSQU0AAQJpZAABEAVyY3Jvc3NmZWVkYmFjawB2YWx1ZQABCQQAAAAAAAAAAABQ
  QVJBTQABAmlkAAEKBXJkZWxheW1zAHZhbHVlAAEJBAAAAAAAQH9AAFBBUkFNAAECaWQAAQwFcmRlbGF5bm90ZQB2YWx1ZQABCQQAAAAAAAAIQABQQVJBTQABAmlkAAEO
  BXJkZWxheW9mZnNldAB2YWx1ZQABCQQAAAAAAADwPwBQQVJBTQABAmlkAAELBXJmZWVkYmFjawB2YWx1ZQABCQQAAAAAAAA+QABQQVJBTQABAmlkAAEKBXJoaWdoY3V0
  AHZhbHVlAAEJBAAAAAAAiNNAAFBBUkFNAAECaWQAAQkFcmxvd2N1dAB2YWx1ZQABCQQAAAAAAAA0QABQQVJBTQABAmlkAAEGBXJwYW4AdmFsdWUAAQkEAAAAAAAA8D8A
  UEFSQU0AAQJpZAABCQVyc291cmNlAHZhbHVlAAEJBAAAAAAAAABAAFBBUkFNAAECaWQAAQcFd2V0ZGIAdmFsdWUAAQkEAAAAAAAAJMAAAAAAAAAAAABKVUNFUHJpdmF0
  ZURhdGEAAQFCeXBhc3MAAQEDAB0AAAAAAAAASlVDRVByaXZhdGVEYXRhAAAAAAAAAAA=
  AEZhY3RvcnkgUHJlc2V0czogRmFjdG9yeSBEZWZhdWx0ABAAAAA=
>`);
    });
  }); // describe multiline parameters rule
}); // describe dump
  