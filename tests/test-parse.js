const mocha = require('mocha');
const should = require('should');
const parser = require('../src/parser-debug');

const Serializers = require('../src/serializer.js')
const Base = Serializers.BaseSerializer
const Vst = Serializers.VstSerializer
const Notes = Serializers.NotesSerializer

describe('parser', function() {

  describe('object rule', function() {
    // To use a custom 'startRule', you must add it to the gen-debug npm script
    const parse = input => parser.parse(input, {startRule: 'object'});

    // TODO: Check if reaper ever puts objects one line
    it('should parse a one line object', function() {
      parse('<TEST 1\n>').should.deepEqual(new Base({
        token: 'TEST',
        params: [1],
        contents: [],
      }));
    });

    it('should parse a multiline object with two structs', function() {
      parse(`<NAME "GUITAR"\n  VOLUME 11\n>`).should.deepEqual(new Base({
        token: 'NAME',
        params: ['GUITAR'],
        contents: [
          {token: 'VOLUME', params: [11]},
        ],
      }));
    });

    it('should parse a multiline object with two structs and indents', function() {
      parse(`  <NAME "GUITAR"\n    VOLUME 11\n  >`).should.deepEqual(new Base({
        token: 'NAME',
        params: ['GUITAR'],
        contents: [
          {token: 'VOLUME', params: [11]},
        ],
      }));
    });

    it('should parse a multiline object with two structs and an object', function() {
      parse(`<NAME "GUITAR"\n  VOLUME 11\n  <METRONOME 6 2\n    VOL 0.25 0.125\n  >\n>`).should.deepEqual(new Base({
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
          })
        ],
      }));
    });
  }); // Describe object Rule

  describe('int rule', function() {
    // To use a custom 'startRule', you must add it to the gen-debug npm script
    const parse = input => parser.parse(input, {startRule: 'int'});

    it('should parse 0', function() { parse('0').should.deepEqual(0); });
    it('should parse 100', function() { parse('100').should.deepEqual(100); });
    it('should parse negative integers', function() { parse('-10').should.deepEqual(-10); });
  }) // Describe int rule

  describe('decimal rule', function() {
    // To use a custom 'startRule', you must add it to the gen-debug npm script
    const parse = input => parser.parse(input, {startRule: 'decimal'});

    it('should parse 0.0', function() { parse('0.0').should.deepEqual(0); });
    it('should parse 0.5', function() { parse('0.5').should.deepEqual(0.5); });
    it('should parse 101.555', function() { parse('101.555').should.deepEqual(101.555); });
    it('should parse negative integers', function() { parse('-10.1234').should.deepEqual(-10.1234); });
  }) // Describe decimal rule

  describe('params rule', function() {
    // To use a custom 'startRule', you must add it to the gen-debug npm script
    const parse = input => parser.parse(input, {startRule: 'params'});

    const t01 = ' 0 1';
    it(`should parse "${t01}" as two ints`, function() {
      parse(t01).should.deepEqual([0, 1]);
    });

    const t02 = ' 5 10';
    it(`should parse "${t02}" as two ints`, function() {
      parse(t02).should.deepEqual([5, 10]);
    });

    const t03 = ' "ok" 1 2 3';
    it(`should parse "${t03}" as a string and three ints`, function() {
      parse(t03).should.deepEqual(['ok', 1, 2, 3]);
    });

    const t04 = ' "" 1234{}';
    it(`should parse "${t04}" as an empty string and a string that starts with an integer`, function() {
      parse(t04).should.deepEqual(['', '1234{}']);
    });
  }); // describe params

  describe('string rule', function() {
    // To use a custom 'startRule', you must add it to the gen-debug npm script
    const parse = input => parser.parse(input, {startRule: 'string'});

    it('should parse double quoted strings', function() {
      parse('"Okay this is a string"').should.equal('Okay this is a string');
      parse('""').should.equal('');
    });

    it('should uandle unquoted strings (strings that do not start w/ a space, quote, or backtick)', () => {
      parse('aString').should.equal('aString');
      parse('hel"lo').should.equal('hel"lo');
      parse('hello"').should.equal('hello"');
    });

    it('should handle non-alphanumeric characters', function() {
      parse('"! ok"').should.equal('! ok');
      parse('"ok !"').should.equal('ok !');
      parse('!@#$%^&*()_+').should.equal('!@#$%^&*()_+');
    });

    it('should handle strings beginning with quotes', function() {
      parse(`"''"`).should.equal(`''`);
      parse(`'"'`).should.equal(`"`);
      parse('"```"').should.equal('```');
      parse('`"`').should.equal('"');
    });

  }); // describe string rule


  describe('multiline parameters', function() {
    // To use a custom 'startRule', you must add it to the gen-debug npm script
    const parse = input => parser.parse(input, {startRule: 'object'});

    it('should parse NOTES objects', function() {
      parse('<NOTES\n  || Line one with extra pipes |\n  | Second Line\n>').should.deepEqual(new Notes({
        token: 'NOTES',
        params: ['| Line one with extra pipes |\n Second Line'],
        contents: [],
      }))
    });

    it('should parse strings that start with a string delimiter and contain all delimiters', () => {
      parse(`<NAME \`''''''"""\`\n  <NAME\n    |'''\`\`\`"""\n  >\n>`).should.deepEqual(new Base({
        token: 'NAME',
        params: [`'''\`\`\`"""`,],
        contents: [],
      }));
    });

    it('should parse VSTs/Plugins containing Base64', function() {
      parse(`<VST "VST3: #TStereo Delay (Tracktion)" "#TStereo Delay.vst3" 0 "" 1997878177{5653545344656C237473746572656F20} ""
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
>`).should.deepEqual(new Vst({
        token: 'VST',
        params: ['VST3: #TStereo Delay (Tracktion)', '#TStereo Delay.vst3', 0, '', '1997878177{5653545344656C237473746572656F20}', '',
                `oTMVd+9e7f4CAAAAAQAAAAAAAAACAAAAAAAAAAIAAAABAAAAAAAAAAIAAAAAAAAAEgUAAAEAAAD//xAA`,
                `AgUAAAEAAABWc3RXAAAACAAAAAEAAAAAQ2NuSwAABOpGQkNoAAAAAlNEZWwAAQAmAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEUlBST0dSQU0AAQRwbHVnaW5JRAABDwVUU3RlcmVvIERlbGF5AHByb2dyYW1EaXJ0eQABAQNjdXJyZW50UHJvZ3JhbQABEQVGYWN0b3J5IERlZmF1bHQAcHJvZ3JhbUlEAAABF1BBUkFNAAECaWQAAQsFZGVsYXlzeW5jAHZhbHVlAAEJBAAAAAAAAPA/AFBBUkFNAAECaWQAAQcFZHJ5ZGIAdmFsdWUAAQkEAAAAAAAARMAAUEFSQU0AAQJpZAABCAVlbmFibGUAdmFsdWUAAQkEAAAAAAAA8D8AUEFSQU0AAQJpZAABBwVpbnB1dAB2YWx1ZQABCQQAAAAAAAAAAABQQVJBTQABAmlkAAEQBWxjcm9zc2ZlZWRiYWNrAHZhbHVlAAEJBAAAAAAAAAAAAFBBUkFNAAECaWQAAQoFbGRlbGF5bXMAdmFsdWUAAQkEAAAAAABAf0AAUEFSQU0AAQJpZAABDAVsZGVsYXlub3RlAHZhbHVlAAEJBAAAAAAAAAhAAFBBUkFNAAECaWQAAQ4FbGRlbGF5b2Zmc2V0AHZhbHVlAAEJBAAAAAAAAPA/AFBBUkFNAAECaWQAAQsFbGZlZWRiYWNrAHZhbHVlAAEJBAAAAAAAAD5AAFBBUkFNAAECaWQAAQoFbGhpZ2hjdXQAdmFsdWUAAQkEAAAAAACI00AAUEFSQU0AAQJpZAABCQVsbG93Y3V0AHZhbHVlAAEJBAAAAAAAADRAAFBBUkFNAAECaWQAAQYFbHBhbgB2YWx1ZQABCQQAAAAAAADwvwBQQVJBTQABAmlkAAEJBWxzb3VyY2UAdmFsdWUAAQkEAAAAAAAA8D8AUEFSQU0AAQJpZAABEAVyY3Jvc3NmZWVkYmFjawB2YWx1ZQABCQQAAAAAAAAAAABQQVJBTQABAmlkAAEKBXJkZWxheW1zAHZhbHVlAAEJBAAAAAAAQH9AAFBBUkFNAAECaWQAAQwFcmRlbGF5bm90ZQB2YWx1ZQABCQQAAAAAAAAIQABQQVJBTQABAmlkAAEOBXJkZWxheW9mZnNldAB2YWx1ZQABCQQAAAAAAADwPwBQQVJBTQABAmlkAAELBXJmZWVkYmFjawB2YWx1ZQABCQQAAAAAAAA+QABQQVJBTQABAmlkAAEKBXJoaWdoY3V0AHZhbHVlAAEJBAAAAAAAiNNAAFBBUkFNAAECaWQAAQkFcmxvd2N1dAB2YWx1ZQABCQQAAAAAAAA0QABQQVJBTQABAmlkAAEGBXJwYW4AdmFsdWUAAQkEAAAAAAAA8D8AUEFSQU0AAQJpZAABCQVyc291cmNlAHZhbHVlAAEJBAAAAAAAAABAAFBBUkFNAAECaWQAAQcFd2V0ZGIAdmFsdWUAAQkEAAAAAAAAJMAAAAAAAAAAAABKVUNFUHJpdmF0ZURhdGEAAQFCeXBhc3MAAQEDAB0AAAAAAAAASlVDRVByaXZhdGVEYXRhAAAAAAAAAAA=`,
                `AEZhY3RvcnkgUHJlc2V0czogRmFjdG9yeSBEZWZhdWx0ABAAAAA=`],
        contents: [],
      }));
    });
  }); // describe multiline parameters rule
}); // describe parse