// Builds the publishable Post Maker page from template.html:
//   node brand/post-maker/build.cjs <out.html>
// Fills __FS_MARK__ and __LOCKUP__ with the real logo files (base64 data
// URIs) and __CLUBS__ with clubs.json (each club's badge colours).
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const dataUri = (f) => "data:image/svg+xml;base64," + fs.readFileSync(path.join(root, f)).toString("base64");
const clubs = JSON.stringify(JSON.parse(fs.readFileSync(path.join(__dirname, "clubs.json"), "utf8")));
const html = fs.readFileSync(path.join(__dirname, "template.html"), "utf8")
  .split("__FS_MARK__").join(dataUri("fullset-lockup.svg"))
  .split("__LOCKUP__").join(dataUri("fullset-header-lockup.svg"))
  .replace("__CLUBS__", clubs);
fs.writeFileSync(process.argv[2], html);
console.log("built", process.argv[2], html.length, "bytes");
