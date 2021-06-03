//index.js

const express = require('express');
const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');

const app = express();

app.use(express.static('public')); 

//mainRoom endpoint
app.get('/mainRoom', function(req,res){ 

    //req.query 파라미터 받아오기 
    let roomName = req.query.roomName;  
    let roomUrl = req.query.roomUrl; 
    let hostlat = req.query.hostlat;
    let hostlong = req.query.hostlong; 
    
    //db insert
    insert(roomName, hostlat, hostlong, roomUrl);
    
    //res.end();
});

//enterRoom endpoint 
app.get('/roomList', async function(req,res){  
    //geoX, geoY 
    let userlat = parseFloat(req.query.userlat);
    let userlong = parseFloat(req.query.userlong);
    //search 범위 설정
    let x1 = userlat - 0.0000157;
    let x2 = userlat + 0.0000157; 
    let y1 = userlong - 0.0000157; 
    let y2 = userlong + 0.0000157;
    
    //db select
    let db = await getDBConnection();
    let sqlString = `SELECT roomName, hostlat, hostlong, roomUrl, numOfPeople FROM GROUPS WHERE  
                    hostlat >= ${x1} AND hostlat <= ${x2} AND hostlong >= ${y1} AND hostlong <= ${y2}`;
    let rows = await db.all(sqlString);
    db.close();
 
    //추가
    res.json(rows);
    res.end();
});  

app.get('/enterSubRoom', async function(req, res){
    
    let roomName = req.query.roomName;

    //db set 
    let db = await getDBConnection();
    let sqlString1 = `UPDATE GROUPS SET numOfPeople = numOfPeople + 1 WHERE roomName = (?)`;
    await db.run(sqlString1, [roomName]);
    db.close();
    res.end();
     
});

app.get('/updateRoom', async function(req, res){ 

    let roomName = req.query.roomName;

    //db select
    let db = await getDBConnection();
    let sqlString2 = 'SELECT numOfPeople FROM GROUPS WHERE roomName = ' + `'${roomName}'`; 
    let num = await db.all(sqlString2);
    db.close();
    
    res.send(num[0]);   
});

app.get('/unloadRoom', async function(req, res){
    
    let roomName = req.query.roomName;

    //db set 
    let db = await getDBConnection();
    let sqlString1 = `UPDATE GROUPS SET numOfPeople = numOfPeople - 1 WHERE roomName = (?)`;
    await db.run(sqlString1, [roomName]);
    db.close();
    res.end();
     
});

//port 연결
app.listen(3000, function(){
    console.log('server on! http://localhost:' + 3000);
});

//function insert
async function insert(roomName, hostlat, hostlong, roomUrl){ 
    let db = await getDBConnection();
    let sqlString = `INSERT INTO GROUPS (roomName, hostlat, hostlong, roomUrl, numOfPeople) VALUES(?, ? , ?, ?, ?)`;
    await db.run(sqlString, [roomName, hostlat, hostlong, roomUrl, 1]);
    await db.close();
}

 

//function getDB
async function getDBConnection(){ 
    const db = await sqlite.open({ 
        filename: 'group.db', 
        driver: sqlite3.Database
    });
    return db; 
}
