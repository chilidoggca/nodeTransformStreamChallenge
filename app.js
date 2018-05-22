const fs = require('fs');
// const filePath = __dirname + '/input.log';
// let file = fs.readFileSync(filePath);
// console.log('Initial File content : ' + file);

const { Transform } = require('stream');

// app requires filename as third argument to run
if (process.argv.length !== 3) {
  console.log(`filename is required! e.g. node app lorem.txt`);
  process.exit(1);
}
const filename = process.argv[2];

const srcfile = __dirname + '/' + filename
const src = fs.createReadStream(srcfile, 'utf-8');
const srcIntegrity = fs.createWriteStream(__dirname + '/srcIntegrity.log'); //checks integrity

let start = null;
let bytes = 0;
let lines = 1;
let summary = {};
const objectSummary = new Transform({
  transform(chunk, encoding, callback) {
    if (start === null) start = process.hrtime();
    bytes += chunk.length;
    for (let i = 0; i < chunk.length; i++) {
      if (chunk[i] == 10 || chunk[i] == 13) lines++; //checking for carriage returns and line feeds
    }
    process.stdout.write('.');
    callback(null, chunk);
  }
});
objectSummary._flush = function (callback) {
  console.log("Starting objectSummary flush block...");
  let seconds = process.hrtime(start);
  seconds = (seconds[0] * 1e9 + seconds[1]) * 1e-9;
  summary.elapsedTime = seconds;
  summary.totalLengthInBytes = bytes;
  summary.totalLines = lines;
  summary.timeStamp = new Date;
  return process.nextTick(function () {
    console.log("Returning objectSummary flush result...");
    console.log(summary);
    fs.createWriteStream(__dirname + '/objectSummaryAll.log', {flags: 'a'}).write(`${JSON.stringify(summary)}\n`);
    fs.createWriteStream(__dirname + '/objectSummary.log').write(JSON.stringify(summary));
    callback();
  });
};

const readableSummary = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(chunk, encoding, callback) {
    // console.log("readableSummary transform block")
    callback(null, chunk);
  }
});
readableSummary._flush = function (callback) {
  console.log("Starting readableSummary flush block...");
  let report = '';

  const objectToReadable = new Transform({
    readableObjectMode: true,
    writableObjectMode: true,
    transform(data, encoding, callback) {
      // data = JSON.parse(data);
      // console.log('inside object to read ==================================' + data);
      // report = `The throughput was ${data.totalLengthInBytes / data.elapsedTime} bytes/second.`;
      let temp;
      Promise
        .resolve(data)
        .then(temp = JSON.parse(data))
        .then(report = `The throughput was ${temp.totalLengthInBytes / temp.elapsedTime} bytes/second.`)
        .then(console.log('===========report=============', report));
      callback(null, data);
    }
  });
  objectToReadable._flush = function (callback) {
    console.log("Starting objectToReadable flush block...");
    return process.nextTick(function () {
      console.log("Returning objectToReadable flush result...");
      fs.createWriteStream(__dirname + '/readableSummaryAll.log', {flags: 'a'}).write(`${report}\n`);
      fs.createWriteStream(__dirname + '/readableSummary.log').write(report);
      callback();
    });
  };

  const lastSumObj = fs.createReadStream(__dirname + '/objectSummary.log', 'utf-8');
  lastSumObj.pipe(objectToReadable);

  return process.nextTick(function () {
    // setTimeout(()=>console.log('blah'), 1000);
    console.log("Returning readableSummary flush result...");
    callback();
  });
}


src
  .on('error', error => console.log(error))
  .pipe(objectSummary)
  .on('error', error => console.log(error))
  .pipe(readableSummary)
  .on('error', error => console.log(error))
  .pipe(srcIntegrity) // check integrity
  .on('error', error => console.log(error));

srcIntegrity.on('finish', assertionTest);


// Testing
function assertionTest() {
  console.log('Assert file size is correct')
  function getFilesizeInBytes(file) {
    const stats = fs.statSync(file)
    const fileSizeInBytes = stats.size
    return fileSizeInBytes
  }
  const fsFilesize = getFilesizeInBytes(filename);
  console.log('Expect ' + summary.totalLengthInBytes + ' to equal ' + fsFilesize + '.');
  if ( summary.totalLengthInBytes === fsFilesize ) {
    return console.log('Passed.');
  } else {
    console.log('Failed.');
  }
}


// Watch srcfile
fs.watch(srcfile, function() {
  const newSrc = fs.createReadStream(srcfile);
  let newStart = null;
  let newBytes = 0;
  let newLines = 1;
  let newSummary = {};
  let growthObj = {};
  const growthRate = new Transform({
    readableObjectMode: true,
    writableObjectMode: true,
    transform(chunk, encoding, callback) {
      if (newStart === null) newStart = process.hrtime();
      newBytes += chunk.length;
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] == 10 || chunk[i] == 13) newLines++; //checking for carriage returns and line feeds
      }
      process.stdout.write('.');
      callback(null, chunk);
    }
  });
  growthRate._flush = function (callback) {
    let newSeconds = process.hrtime(newStart);
    newSeconds = (newSeconds[0] * 1e9 + newSeconds[1]) * 1e-9;
    newSummary.elapsedTime = newSeconds;
    newSummary.totalLengthInBytes = newBytes;
    newSummary.totalLines = newLines;
    newSummary.timeStamp = new Date;
    growthObj.timeStamp = new Date;
    growthObj.bytesGrowth = newSummary.totalLengthInBytes - summary.totalLengthInBytes;
    growthObj.linesGrowth = newSummary.totalLines - summary.totalLines;
    growthObj.secondsSinceStart = process.hrtime(start); // time since starting running this script
    growthObj.durationSinceStart = (growthObj.secondsSinceStart[0] * 1e9 + growthObj.secondsSinceStart[1]) * 1e-9;
    growthObj.bytesGrowthRate = growthObj.bytesGrowth / growthObj.durationSinceStart;
    growthObj.linesGrowthRate = growthObj.linesGrowth / growthObj.durationSinceStart;
    console.log("Starting growthRate flush block...");
    console.log("Summary inside growth rate transform", summary);
    console.log("New summary inside growth rate transform", newSummary);
    console.log("Growth object inside growth rate transform", growthObj);
    console.log(`The growth rate of this file is ${JSON.stringify(growthObj.bytesGrowthRate)} bytes/s or ${JSON.stringify(growthObj.linesGrowthRate)} lines/s since running this script\n`);
    return process.nextTick(function () {
      console.log("Returning growthRate flush result...");
      fs.createWriteStream(__dirname + '/growthRateAll.log', {flags: 'a'}).write(`${JSON.stringify(growthObj)}\n`);
      fs.createWriteStream(__dirname + '/growthRate.log').write(JSON.stringify(growthObj));
      fs.createWriteStream(__dirname + '/growthRateReadableAll.log', {flags: 'a'})
        .write(`The growth rate of this file is ${JSON.stringify(growthObj.bytesGrowthRate)} bytes/s or ${JSON.stringify(growthObj.linesGrowthRate)} lines/s since running this script\n`);
      fs.createWriteStream(__dirname + '/growthRateReadable.log')
        .write(`The growth rate of this file is ${JSON.stringify(growthObj.bytesGrowthRate)} bytes/s or ${JSON.stringify(growthObj.linesGrowthRate)} lines/s since running this script\n`);
      callback();
    });
  };
  newSrc
    .on('error', error => console.log(error))
    .pipe(growthRate)
    .on('error', error => console.log(error))
    .pipe(fs.createWriteStream(__dirname + '/growthIntegrity.log')) //ensure data stream integrity
    .on('error', error => console.log(error));
});

// Example Use of watchfile
// fs.watchFile(srcfile, function() {
//     console.log('File Changed ...');
//     file = fs.readFileSync(srcfile);
//     console.log('File content at : ' + new Date() + ' is \n' + file);
// });
