const fetch = require('node-fetch');
const _ = require('underscore');
const express = require("express");
const mysql = require('mysql');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const pool = dbConnection();

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({extended: true}))
app.use(express.json());


app.set('trust proxy', 1)
app.use(session({
  secret: 'topsecret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}))

var cpu = [];
var cpuCooler = [];
var motherboard = [];
var videoCard = [];
var memory = [];
var storage = [];
var compCase = [];
var power = [];
var os = [];
var monitor = [];
var eStorage = [];

var mUserId = session.userId;

app.get("/", async function(req, res){
  let sql = "SELECT * FROM pc_built";
  let rows = await executeSQL(sql);

  res.render("homepage", {"pc":rows, "user":mUserId});
});

app.get("/login", async function(req, res){
  let url = "http://api.giphy.com/v1/gifs/search?api_key=sGXrsuKU33Y3pg3s3hgAvnqnEWHSjeLO&q=computer&limit=50";
  let data = await getData(url);
  data.data = _.shuffle(data.data);

  res.render("login", {"error":"","gif":data.data[0].images.downsized.url}); 
});

app.post("/login", async function(req, res) {
  let username = req.body.username;
  let pwd = req.body.password;

  let sql = "SELECT * FROM pc_users WHERE username = ?";
  let rows = await executeSQL(sql, [username]);

  let sql2 = "SELECT * FROM pc_built";
  let rows2 = await executeSQL(sql2);

  let url = "http://api.giphy.com/v1/gifs/search?api_key=sGXrsuKU33Y3pg3s3hgAvnqnEWHSjeLO&q=computer&limit=50";
  let data = await getData(url);
  data.data = _.shuffle(data.data);

  if(rows.length === 0) {
    res.render("login", {"error": "User doesn't exist","gif":data.data[0].images.downsized.url});
    return;
  }

  if(rows[0].password == pwd) {
    req.session.authenticated = true;
    mUserId = rows[0].userId;

    res.render("homepage", {"user":rows, "pc":rows2});
  } else {
    res.render("login", {"error": "Wrong password","gif":data.data[0].images.downsized.url});
  }
});

app.post("api/login", async function (req, res) {
  let username = req.body.username;
  let pwd = req.body.password;

  let sql = "SELECT * FROM pc_users WHERE username = ?";
  let rows = await executeSQL(sql, [username]);

  let sql2 = "SELECT * FROM pc_built";
  let rows2 = await executeSQL(sql2);

  if(rows.length === 0) {
    res.send({"authentication": "userFail"});
    return;
  }

  if(rows[0].password == pwd) {
    req.session.authenticated = true;
    mUserId = rows[0].userId;

    res.send({"authentication":"success"});
  } else {
    res.send("login", {"error": "passwordFail"});
  }

});

app.get("/logout", function(req, res){
  req.session.destroy();
  mUserId = session.userId;
  cpu = [];
  cpuCooler = [];
  motherboard = [];
  videoCard = [];
  memory = [];
  storage = [];
  compCase = [];
  power = [];
  os = [];
  monitor = [];
  eStorage = [];
  res.redirect("/");
});

app.get("/account/new", function(req, res) {
  res.render("createAccount");
});

app.post("/account/new", async function(req, res) {
  let username = req.body.username;
  let password = req.body.password;
  let fName = req.body.firstName;
  let lName = req.body.lastName;
  let dateOfBirth = req.body.dob;

  let sql = "INSERT INTO pc_users (username, password, firstName, lastName, dob) VALUES (?, ?, ?, ?, ?)";
  let params = [username, password, fName, lName, dateOfBirth];
  let rows = await executeSQL(sql, params);

  //Message to show account created
  
  res.redirect("/");  
});

app.get("/admin", function (req, res) {
  res.render("admin");
});

//Parts List
app.get("/admin/parts", async function (req, res) {
  let sql = "SELECT * FROM pc_comp";
  let rows = await executeSQL(sql);

  res.render("adminPartsList", {"parts":rows});
});

//Edit Parts GET
app.get("/admin/parts/update", async function (req, res) {
  let partId = req.query.partId;
  let sql = `SELECT * FROM pc_comp WHERE partId = ${partId}`;
  let rows = await executeSQL(sql);

  res.render("adminEditPart", {"parts":rows});
});

//Edit Parts POST
app.post("/admin/parts/update", async function (req, res) {
  let partId = req.body.partId;
  console.log("partId: ", partId);
  let sql = `UPDATE pc_comp SET partType = ?, partName = ?, price = ?, tax = ?, shipping = ?, urlPic = ? WHERE partId = ${partId}`;
  let params = [req.body.partType, req.body.partName, req.body.price, req.body.tax, req.body.shipping, req.body.urlPic];

  let rows = await executeSQL(sql, params);
  
  res.redirect(`/admin/parts/update?partId=${partId}`);
});

//Delete Parts
app.get("/admin/parts/delete", async function (req, res) {
  let partId = req.query.partId;
  let sql = `DELETE FROM pc_comp WHERE partId = ${partId}`;
  let rows = await executeSQL(sql);

  res.redirect("/admin/parts");
});


app.get("/user/profile", isAuthenticated, async function (req, res) {
  let sql = `SELECT * FROM pc_users WHERE userId = ${mUserId}`;
  let rows = await executeSQL(sql);
  res.render("profile", {"user":mUserId, "isAdmin":rows[0].isAdmin});
});

app.get("/user/profile/builds", isAuthenticated, async function (req, res) {
  let sql1 = `SELECT * FROM pc_build WHERE userId = ${mUserId}`;
  let rows1 = await executeSQL(sql1);
  let sql2 = `SELECT ROUND((cpu_price + cpu_tax + cpu_shipping + cpuCooler_price + cpuCooler_tax + cpuCooler_shipping + motherboard_price + motherboard_tax + motherboard_shipping + videoCard_price + videoCard_tax + videoCard_shipping + memory_price + memory_tax + memory_shipping + storage_price + storage_tax + storage_shipping + case_price + case_tax + case_shipping + powerSupply_price + powerSupply_tax + powerSupply_shipping + operatingSystem_price + operatingSystem_tax + operatingSystem_shipping + monitor_price + monitor_tax + monitor_shipping + externalStorage_price + externalStorage_tax + externalStorage_shipping),2) as totalPrice FROM pc_build WHERE userId = ${mUserId}`;
  let rows2 = await executeSQL(sql2);
  res.render("completedBuilds", {"builds":rows1, "price":rows2})
});



app.get("/user/profile/update", isAuthenticated, async function(req, res){
  let sql = `SELECT *, DATE_FORMAT(dob, '%Y-%m-%d') dobISO FROM pc_users WHERE userId = ${mUserId}`;
  let rows = await executeSQL(sql);

  res.render("profileUpdate", {"user":rows});
});

app.post("/user/profile/update", isAuthenticated, async function(req, res) {
  let sql = `UPDATE pc_users SET firstName = ?, lastName = ?, password = ? WHERE userId = ${mUserId}`;
  let params = [req.body.firstName, req.body.lastName, req.body.password];
  let rows = await executeSQL(sql, params);

  res.redirect(`/user/profile/update?userId=${mUserId}`);
});

app.get("/build", isAuthenticated, async function(req, res){

  console.log("User ID: ", mUserId);
  
  res.render("build", {"cpu":cpu, "cpuCooler":cpuCooler, "motherboard":motherboard, "videoCard":videoCard, "memory":memory, "storage":storage, "compCase":compCase, "power":power, "os":os, "monitor":monitor, "eStorage":eStorage, "user":mUserId});
});

app.post("/build", isAuthenticated, async function(req, res) {
  //Get values 
});

app.get("/build/cpu", async function(req, res){

  let sql = "SELECT * FROM pc_comp WHERE partType = 'cpu' order by price";
  let rows = await executeSQL(sql);

  console.log(rows);

  res.render("cpu", {"cpu":rows, "user":mUserId});
});

app.post("/build/partList", async function(req, res) {
  // let sql = "SELECT * FROM pc_comp WHERE partType = 'cpu'";
  // let rows = await executeSQL(sql);
  let uId = req.body.userId;
  let cpu = req.body.cpu;
  let cpu_price = req.body.cpu_price;
  let cpu_tax = req.body.cpu_tax;
  let cpu_shipping = req.body.cpu_shipping;
  let cpu_urlPic = req.body.cpu_urlPic;
  let cpuCooler = req.body.cpuCooler;
  let cpuCooler_price = req.body.cpuCooler_price;
  let cpuCooler_tax = req.body.cpuCooler_tax;
  let cpuCooler_shipping = req.body.cpuCooler_shipping;
  let cpuCooler_urlPic = req.body.cpuCooler_urlPic;
  let motherboard = req.body.motherboard;
  let motherboard_price = req.body.motherboard_price;
  let motherboard_tax = req.body.motherboard_tax;
  let motherboard_shipping = req.body.motherboard_shipping;
  let motherboard_urlPic = req.body.motherboard_urlPic;
  let videoCard = req.body.videoCard;
  let videoCard_price = req.body.videoCard_price;
  let videoCard_tax = req.body.videoCard_tax;
  let videoCard_shipping = req.body.videoCard_shipping;
  let videoCard_urlPic = req.body.videoCard_urlPic;
  let memory = req.body.memory;
  let memory_price = req.body.memory_price;
  let memory_tax = req.body.memory_tax;
  let memory_shipping = req.body.memory_shipping;
  let memory_urlPic = req.body.memory_urlPic;
  let storage = req.body.storage;
  let storage_price = req.body.storage_price;
  let storage_tax = req.body.storage_tax;
  let storage_shipping = req.body.storage_shipping;
  let storage_urlPic = req.body.storage_urlPic;
  let caseName = req.body.caseName;
  let case_price = req.body.case_price;
  let case_tax = req.body.case_tax;
  let case_shipping = req.body.case_shipping;
  let case_urlPic = req.body.case_urlPic;
  let powerSupply = req.body.powerSupply;
  let powerSupply_price = req.body.powerSupply_price;
  let powerSupply_tax = req.body.powerSupply_tax;
  let powerSupply_shipping = req.body.powerSupply_shipping;
  let powerSupply_urlPic = req.body.powerSupply_urlPic;
  let operatingSystem = req.body.operatingSystem;
  let operatingSystem_price = req.body.operatingSystem_price;
  let operatingSystem_tax = req.body.operatingSystem_tax;
  let operatingSystem_shipping = req.body.operatingSystem_shipping;
  let operatingSystem_urlPic = req.body.operatingSystem_urlPic;
  let monitor = req.body.monitor;
  let monitor_price = req.body.monitor_price;
  let monitor_tax = req.body.monitor_tax;
  let monitor_shipping = req.body.monitor_shipping;
  let monitor_urlPic = req.body.monitor_urlPic;
  let externalStorage = req.body.externalStorage;
  let externalStorage_price = req.body.externalStorage_price;
  let externalStorage_tax = req.body.externalStorage_tax;
  let externalStorage_shipping = req.body.externalStorage_shipping;
  let externalStorage_urlPic = req.body.externalStorage_urlPic;
  console.log(cpu_price);

  let sql = "INSERT INTO pc_build VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

  let params = [uId,cpu,cpu_price,cpu_tax,cpu_shipping,cpu_urlPic,cpuCooler,cpuCooler_price,cpuCooler_tax,cpuCooler_shipping,cpuCooler_urlPic,motherboard,motherboard_price,motherboard_tax,motherboard_shipping,motherboard_urlPic,videoCard,videoCard_price,videoCard_tax,videoCard_shipping,videoCard_urlPic,memory,memory_price,memory_tax,memory_shipping,memory_urlPic,storage,storage_price,storage_tax,storage_shipping,storage_urlPic,caseName,case_price,case_tax,case_shipping,case_urlPic,powerSupply,powerSupply_price,powerSupply_tax,powerSupply_shipping,powerSupply_urlPic,operatingSystem,operatingSystem_price,operatingSystem_tax,operatingSystem_shipping,operatingSystem_urlPic,monitor,monitor_price,monitor_tax,monitor_shipping,monitor_urlPic,externalStorage,externalStorage_price,externalStorage_tax,externalStorage_shipping,externalStorage_urlPic];

  let rows = await executeSQL(sql,params);

  console.log("cool");

  cpu = [];
  cpuCooler = [];
  motherboard = [];
  videoCard = [];
  memory = [];
  storage = [];
  compCase = [];
  power = [];
  os = [];
  monitor = [];
  eStorage = [];

  //need to route somewhere else after adding the row to the table
 res.redirect("/user/profile");
});

// //display info on build page
// app.post("/build", async function(req, res){
//   let cpu = req.body.cpu;

  
// });

app.get("/build/cpuSelected", async function(req, res) {
  let partId = req.query.partId;
  console.log(partId);
  // res.render("");
  let sql = `SELECT * FROM pc_comp WHERE partId = ${partId}`;
  cpu = await executeSQL(sql);

  console.log(cpu);

  res.render("build", {"cpu":cpu, "cpuCooler":cpuCooler, "motherboard":motherboard, "videoCard":videoCard, "memory":memory, "storage":storage, "compCase":compCase, "power":power, "os":os, "monitor":monitor, "eStorage":eStorage, "user":mUserId});
});

app.get("/build/cpuCooler", async function(req, res){

  let sql = "SELECT * FROM pc_comp WHERE partType = 'cpuCooler' order by price";
  let rows = await executeSQL(sql);

  console.log(rows);

  res.render("cpuCooler", {"cpuCooler":rows, "user":mUserId});
});

app.get("/build/cpuCoolerSelected", async function(req, res) {
  let partId = req.query.partId;
  console.log(partId);
  // res.render("");
  let sql = `SELECT * FROM pc_comp WHERE partId = ${partId}`;
  cpuCooler = await executeSQL(sql);

  console.log(cpuCooler);

  res.render("build", {"cpu":cpu, "cpuCooler":cpuCooler, "motherboard":motherboard, "videoCard":videoCard, "memory":memory, "storage":storage, "compCase":compCase, "power":power, "os":os, "monitor":monitor, "eStorage":eStorage, "user":mUserId});
});

app.get("/build/motherboard", async function(req, res){

  let sql = "SELECT * FROM pc_comp WHERE partType = 'motherboard' order by price";
  let rows = await executeSQL(sql);

  console.log(rows);

  res.render("motherboard", {"motherboard":rows, "user":mUserId});
});

app.get("/build/motherboardSelected", async function(req, res) {
  let partId = req.query.partId;
  console.log(partId);
  // res.render("");
  let sql = `SELECT * FROM pc_comp WHERE partId = ${partId}`;
  motherboard = await executeSQL(sql);

  console.log(motherboard);

  res.render("build", {"cpu":cpu, "cpuCooler":cpuCooler, "motherboard":motherboard, "videoCard":videoCard, "memory":memory, "storage":storage, "compCase":compCase, "power":power, "os":os, "monitor":monitor, "eStorage":eStorage, "user":mUserId});
});

app.get("/build/videoCard", async function(req, res){

  let sql = "SELECT * FROM pc_comp WHERE partType = 'videoCard' order by price";
  let rows = await executeSQL(sql);

  console.log(rows);

  res.render("videoCard", {"videoCard":rows, "user":mUserId});
});

app.get("/build/videoCardSelected", async function(req, res) {
  let partId = req.query.partId;
  console.log(partId);
  // res.render("");
  let sql = `SELECT * FROM pc_comp WHERE partId = ${partId}`;
  videoCard = await executeSQL(sql);

  console.log(videoCard);

  res.render("build", {"cpu":cpu, "cpuCooler":cpuCooler, "motherboard":motherboard, "videoCard":videoCard, "memory":memory, "storage":storage, "compCase":compCase, "power":power, "os":os, "monitor":monitor, "eStorage":eStorage, "user":mUserId});
});

app.get("/build/memory", async function(req, res){

  let sql = "SELECT * FROM pc_comp WHERE partType = 'memory' order by price";
  let rows = await executeSQL(sql);

  console.log(rows);

  res.render("memory", {"memory":rows, "user":mUserId});
});

app.get("/build/memorySelected", async function(req, res) {
  let partId = req.query.partId;
  console.log(partId);
  // res.render("");
  let sql = `SELECT * FROM pc_comp WHERE partId = ${partId}`;
  memory = await executeSQL(sql);

  console.log(memory);

  res.render("build", {"cpu":cpu, "cpuCooler":cpuCooler, "motherboard":motherboard, "videoCard":videoCard, "memory":memory, "storage":storage, "compCase":compCase, "power":power, "os":os, "monitor":monitor, "eStorage":eStorage, "user":mUserId});
});

app.get("/build/storage", async function(req, res){

  let sql = "SELECT * FROM pc_comp WHERE partType = 'storage' order by price";
  let rows = await executeSQL(sql);

  console.log(rows);

  res.render("storage", {"storage":rows, "user":mUserId});
});

app.get("/build/storageSelected", async function(req, res) {
  let partId = req.query.partId;
  console.log(partId);
  // res.render("");
  let sql = `SELECT * FROM pc_comp WHERE partId = ${partId}`;
  storage = await executeSQL(sql);

  console.log(storage);

  res.render("build", {"cpu":cpu, "cpuCooler":cpuCooler, "motherboard":motherboard, "videoCard":videoCard, "memory":memory, "storage":storage, "compCase":compCase, "power":power, "os":os, "monitor":monitor, "eStorage":eStorage, "user":mUserId});
});

app.get("/build/case", async function(req, res){

  let sql = "SELECT * FROM pc_comp WHERE partType = 'case' order by price";
  let rows = await executeSQL(sql);

  console.log(rows);

  res.render("case", {"cases":rows, "user":mUserId});
});

app.get("/build/caseSelected", async function(req, res) {
  let partId = req.query.partId;
  console.log(partId);
  // res.render("");
  let sql = `SELECT * FROM pc_comp WHERE partId = ${partId}`;
  compCase = await executeSQL(sql);

  console.log(compCase);

  res.render("build", {"cpu":cpu, "cpuCooler":cpuCooler, "motherboard":motherboard, "videoCard":videoCard, "memory":memory, "storage":storage, "compCase":compCase, "power":power, "os":os, "monitor":monitor, "eStorage":eStorage, "user":mUserId});
});
app.get("/build/powersupply", async function(req, res){

  let sql = "SELECT * FROM pc_comp WHERE partType = 'powersupply' order by price";
  let rows = await executeSQL(sql);

  console.log(rows);

  res.render("powersupply", {"powersupply":rows, "user":mUserId});
});

app.get("/build/powersupplySelected", async function(req, res) {
  let partId = req.query.partId;
  console.log(partId);
  // res.render("");
  let sql = `SELECT * FROM pc_comp WHERE partId = ${partId}`;
  power = await executeSQL(sql);

  console.log(power);

  res.render("build", {"cpu":cpu, "cpuCooler":cpuCooler, "motherboard":motherboard, "videoCard":videoCard, "memory":memory, "storage":storage, "compCase":compCase, "power":power, "os":os, "monitor":monitor, "eStorage":eStorage, "user":mUserId});
});

app.get("/build/os", async function(req, res){

  let sql = "SELECT * FROM pc_comp WHERE partType = 'os' order by price";
  let rows = await executeSQL(sql);

  console.log(rows);

  res.render("os", {"os":rows, "user":mUserId});
});

app.get("/build/osSelected", async function(req, res) {
  let partId = req.query.partId;
  console.log(partId);
  // res.render("");
  let sql = `SELECT * FROM pc_comp WHERE partId = ${partId}`;
  os = await executeSQL(sql);

  console.log(os);

  res.render("build", {"cpu":cpu, "cpuCooler":cpuCooler, "motherboard":motherboard, "videoCard":videoCard, "memory":memory, "storage":storage, "compCase":compCase, "power":power, "os":os, "monitor":monitor, "eStorage":eStorage, "user":mUserId});
});

app.get("/build/monitor", async function(req, res){

  let sql = "SELECT * FROM pc_comp WHERE partType = 'monitor' order by price";
  let rows = await executeSQL(sql);

  console.log(rows);

  res.render("monitor", {"monitor":rows, "user":mUserId});
});

app.get("/build/monitorSelected", async function(req, res) {
  let partId = req.query.partId;
  console.log(partId);
  // res.render("");
  let sql = `SELECT * FROM pc_comp WHERE partId = ${partId}`;
  monitor = await executeSQL(sql);

  console.log(monitor);

  res.render("build", {"cpu":cpu, "cpuCooler":cpuCooler, "motherboard":motherboard, "videoCard":videoCard, "memory":memory, "storage":storage, "compCase":compCase, "power":power, "os":os, "monitor":monitor, "eStorage":eStorage, "user":mUserId});
});

app.get("/build/eStorage", async function(req, res){

  let sql = "SELECT * FROM pc_comp WHERE partType = 'externalStorage' order by price";
  let rows = await executeSQL(sql);

  console.log(rows);

  res.render("eStorage", {"eStorage":rows, "user":mUserId});
});

app.get("/build/eStorageSelected", async function(req, res) {
  let partId = req.query.partId;
  console.log(partId);
  // res.render("");
  let sql = `SELECT * FROM pc_comp WHERE partId = ${partId}`;
  eStorage = await executeSQL(sql);

  console.log(eStorage);

  res.render("build", {"cpu":cpu, "cpuCooler":cpuCooler, "motherboard":motherboard, "videoCard":videoCard, "memory":memory, "storage":storage, "compCase":compCase, "power":power, "os":os, "monitor":monitor, "eStorage":eStorage, "user":mUserId});
});

app.get("/prebuilt", isAuthenticated, async function(req, res){
let sql = `SELECT * FROM pc_built`;
let rows = await executeSQL(sql);
// let sql1 = "SELECT * FROM pc_build";
// let rows1 = await executeSQL(sql1);
  res.render("prebuilt", {"prebuilts": rows, "user":mUserId});
});


//Functions
function isAuthenticated(req, res, next) { 
  if(!req.session.authenticated) {
    res.redirect("/login");
  } else {
    next();
  }
}

async function executeSQL(sql, params){
return new Promise (function (resolve, reject) {
pool.query(sql, params, function (err, rows, fields) {
if (err) throw err;
   resolve(rows);
});
});
}

async function getData(url) {
  let response = await fetch(url);
  let data = await response.json();
  return data;
}

function dbConnection(){

   const pool  = mysql.createPool({

      connectionLimit: 10,
      host: "u6354r3es4optspf.cbetxkdyhwsb.us-east-1.rds.amazonaws.com",
      user: "wtsttu956f50kifq",
      password: "ji1utwrop9uy5x1x",
      database: "u8qmztyg7662z0j9"

   }); 

   return pool;

}

app.listen(3000, () => {
console.log("Expresss server running...")
} )