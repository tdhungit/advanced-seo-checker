var path = require('path');
var fs = require('fs');
var SEOChecker = require(path.resolve('./src/index'));

var url = 'http://hazemhagrass.com';
var crawler = SEOChecker(url, {});
// crawler.load(url, function (html) {
//   crawler.test(url, html).then((summary) => {
//     console.log(summary);
//   });
// });
//An example to crawl URLs for certain website
crawler.on('done', function (result) {
  // fs.writeFileSync('output.json', JSON.stringify(result));
});
crawler.start();
