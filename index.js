const FRONT_SERVER_PORT = 3000;
const WEBSOCKET_SERVER_PORT = 3001;

const WebSocket = require("ws");
const shortid = require("shortid");
const cors = require("cors");
const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');

// global variables
const ConnectionMap = new Map();

const express = require("express");
const httpServer = express();
httpServer.use(
  cors({
    origin: true,
    credentials: true,
  })
);

httpServer.use(express.static("public"));
httpServer.use(express.json());
// httpServer.use(express.urlencoded({ extended: true }));

//2. set username
httpServer.get("/process/set-username", async(req, res) => {
  const { connectionId, username } = req.query;
  try{
    //db update
    db = await getDBConnection();
    sqlString = 'UPDATE ConnectionMap SET isUsernameSet = 1 WHERE connection_id = ?';
    await db.run(sqlString, [connectionId]);
    await db.close();
    res.json({ success: true });
  }catch(error){
    res.json({ success: false });
  }
});

//5. set moderator 
httpServer.get("/process/set-moderator", async(req, res) => {
  const { connectionId, roomId } = req.query;
  try{
    let db = await getDBConnection();
    //update roomMap moderator
    sqlString = 'UPDATE RoomMap SET moderator = ? WHERE id = ?'
    await db.run(sqlString, [connectionId, roomId]);
    //update roomMap listener ++
    sqlString = 'UPDATE RoomMap SET listeners = listeners + 1 WHERE id = ?';
    await db.run(sqlString, [roomId]);
    //update connectionMap roomname
    sqlString = 'UPDATE ConnectionMap SET room_id = ? WHERE connection_id = ?';
    await db.run(sqlString, [roomId, connectionId]);
    await db.close();
    res.json({ success: true });
  }catch(error){
    res.json({ success: false });
  }
});
 
//6. room join
httpServer.get("/process/join-room", async(req, res) => {
  const { roomId, connectionId } = req.query;
  try{
    //update room info of connectionId
    let db = await getDBConnection();
    sqlString = 'UPDATE ConnectionMap SET room_id = ? WHERE connection_id = ?';
    await db.run(sqlString, [roomId, connectionId]);
    await db.close();
    //update numlisteners
    db = await getDBConnection();
    sqlString = 'UPDATE RoomMap SET listeners = listeners + 1 WHERE id = ?';
    await db.run(sqlString, [roomId]);
    await db.close();
   //select listeners
    db = await getDBConnection();
    sqlString = 'SELECT connection_id FROM ConnectionMap WHERE room_id = ?';
    let cid = await db.all(sqlString, [roomId]);
    await db.close();
    //make room
    db = await getDBConnection();
    sqlString = 'SELECT * FROM RoomMap WHERE id = ?';
    let rm = await db.all(sqlString, [roomId]);
    await db.close(); 
    let id = rm.id;
    let name = rm.name;
    let youtubeUrl = rm.youtubeUrl;
    let moderator = rm.moderator;
    let lat = rm.lat;
    let long = rm.long;
    let location = {lat, long};
    let listeners = []
    for( let c of cid){
      listeners.push(c);
    }
    room = {id, name, youtubeUrl, moderator, location, listeners};
    res.json(room);
  }catch(error){
    res.status(404).send("join failed");
  }
});
/*const newRoom = {
    id,
    name,
    youtubeUrl,
    moderator: null,
    location,
    listeners: [],
  };*/


//7. leave room
httpServer.get("/process/leave-room", async(req, res) => {  
  const { roomId, connectionId } = req.query;
  try{
    //update numlisteners
    db = await getDBConnection();
    sqlString = 'UPDATE RoomMap SET listeners = listeners - 1 WHERE id = ?';
    await db.run(sqlString, [roomId]);
    await db.close();
    //delete connectionId row
    db = await getDBConnection();
    sqlString = 'UPDATE ConnectionMap SET room_id = ? WHERE connection_id = ?';
    await db.run(sqlString, [connectionId]);
    await db.close();
    res.end();
  }catch(error){
    res.status(404).send("leave failed");
  }
});


//4. 현재 존재하는 방의 정보를 가져옴
httpServer.get("/api/rooms", async(req, res) => {
  //db select
  let db = await getDBConnection();
  let sqlString = 'SELECT * FROM RoomMap';
  let result = await db.all(sqlString);
  await db.close();
  
  //hbs listener 변경
  let rooms = [];
  for (let i in result) {
    let id = result[i].id;
    let name = result[i].name;
    let youtubeUrl = result[i].youtubeUrl;
    let moderator = result[i].moderator;
    //select listeners
    db = await getDBConnection();
    sqlString = 'SELECT connection_id FROM ConnectionMap WHERE room_id = ?';
    let cid = await db.all(sqlString, [id]);
    await db.close();
    let listeners = [];
    for( let c of cid){
      listeners.push(c);
    }
    let lat = result[i].lat;
    let long = result[i].long;
    const location = {lat, long};
    let room = {id, name, youtubeUrl, moderator, location, listeners}; 
    rooms.push(room);
  }
  res.json(rooms);
});

//
httpServer.get("/api/connections", (req, res) => {
  let connections = [];
  for (let [connectionId, connection] of ConnectionMap) {
    connections.push({ id: connection.id, username: connection.username });
  }
  res.json(connections);
});

//2. create new room
httpServer.post("/api/rooms", async(req, res) => {
  const { name, youtubeUrl, location } = req.body;
  const id = shortid.generate();
  // db insert
  let db = await getDBConnection();
  let sqlString = 'INSERT INTO RoomMap (id, name, youtubeUrl, moderator, listeners, lat, long)'
                    + 'VALUES (?,?,?,?,?,?,?)';
  await db.run(sqlString, [id, name, youtubeUrl, 'NULL', 0, location.lat, location.long]);
  await db.close();
  res.json({ success: true, roomId: id });
});


//webSocket
const webSocketServer = new WebSocket.Server({ port: WEBSOCKET_SERVER_PORT });
webSocketServer.on("listening", () => {
  console.log(`Websocket Server Listening in Port ${WEBSOCKET_SERVER_PORT}`);
});

//1. connect to websocket
webSocketServer.on("connection", async(connection) => {
    // on connect
    connection.id = shortid.generate();
    connection.isUsernameSet = false;
    ConnectionMap.set(connection.id, connection);

    //db insert
    let db = await getDBConnection();
    let sqlString = 'INSERT INTO ConnectionMap (connection_id, isUsernameSet) VALUES(?,?)';
    await db.run(sqlString, [connection.id, connection.isUsernameSet]);
    await db.close();

    console.log(`Client ${connection.id} Connected!`);
  
    // send connection id
    connection.send(
      JSON.stringify({
        type: "CONNECTION_ESTABLISHED",
        connectionId: connection.id, 
        message: "Connected!", 
      })
    );


  // on disconnect
  connection.on("close", async() => {
    //db 
    db = await getDBConnection();
    //search delete room 
    let sqlString = 'SELECT id FROM RoomMap WHERE moderator = ?';
    let moderatingRoom = await db.all(sqlString, [connection.id]);
    if(moderatingRoom.length > 0){
      let roomId = moderatingRoom[0].id;
      //delete room from listeners  
      sqlString = 'UPDATE ConnectionMap SET connection_id = ? WHERE room_id = ?';
      await db.run(sqlString, ['NULL', roomId]);
      //delete room
      sqlString = 'DELETE FROM RoomMap WHERE id = ?';
      await db.run(sqlString, [roomId]);
      await db.close();
    }
    //remove connection_id of user
    else {
      sqlString = 'UPDATE ConnectionMap SET room_id = ? WHERE connection_id = ?';
      await db.run(sqlString, ['NULL',connection.id]);
      await db.close();
    }
  });   
 
  connection.on("message", (message) => {
    try { 
      const messageData = JSON.parse(message);
      console.log(messageData);
      handleMessage(connection.id, messageData);
      // invalid data
    } catch (e) {
      connection.send( 
        JSON.stringify({
           type: "RESPONSE:MESSAGE",
          success: false,
          reason: "JSON Syntax Error",
          error: e,
        })
       );
      console.error(e);
    } 
  });
});

function handleMessage(connection, message) {

  for (let [connectionId, targetConnection] of ConnectionMap) {
    if (connectionId !== connection.id) {
      targetConnection.send(JSON.stringify(message));
    }
  }
}

httpServer.listen(FRONT_SERVER_PORT, () => {
  console.log(`Server Running At Port ${FRONT_SERVER_PORT}`);
});

//function getDB
async function getDBConnection(){ 
  const db = await sqlite.open({ 
      filename: 'group.db', 
      driver: sqlite3.Database
  });
  return db; 
}