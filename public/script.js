let userlat, userlong, username;

const API_SERVER_URL = "localhost:3000";
const WS_SERVER_URL = "localhost:3001";

// data from server
let ws;
let connectionId;
let rooms = [];

// state
currentRoom = null;

function setRoom(roomId) {
  const room = rooms.find((r) => r.id === roomId);
  currentRoom = room;
}

function clearRoom() {
  currentRoom = null;
}

function fetchRooms() {
  return axios.get("/api/rooms").then((r) => r.data);
}

function getLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(userPosition, showError);
  } else {
    alert("지원하지 않는 브라우저입니다.");
  }
}

function userPosition(position) {
  userlat = (position.coords.latitude * Math.PI) / 180;
  userlong = (position.coords.longitude * Math.PI) / 180;
  console.log("user: " + userlat + " " + userlong);
}

function showError(error) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      alert("위치 정보 요청을 허용해주십시오.");
      break;
    case error.POSITION_UNAVAILABLE:
      alert("위치 정보를 알 수 없습니다.");
      break;
    case error.TIMEOUT:
      alert("요청 시간을 초과하였습니다.");
      break;
    case error.UNKNOWN_ERROR:
      alert("알 수 없는 문제가 발생하였습니다.");
      break;
  }
}

async function loadTemplate(path) {
  return axios.get(path).then((d) => d.data);
}

async function handleShowListClick() {
  rooms = await fetchRooms();
  let template = await loadTemplate("partials/room.hbs");

  rooms = rooms
    .map((room) => {
      let distance = computeDist(
        userlat,
        userlong,
        room.location.lat,
        room.location.long
      );

      distance = parseInt(distance);
      return {
        ...room,
        distance,
      };
    })
    .sort((a, b) => a.distance - b.distance);

  let html = Handlebars.compile(template)({ rooms });
  $(".rooms").html(html);
}

// START
$(document).ready(function () {
  getLocation();

  username = getQueryVariable(window.location.search.substring(1), "username");
  // generate connection with ws server
  ws = new WebSocket("ws://" + WS_SERVER_URL);

  // attach event handler
  ws.onmessage = ({ data }) => {
    data = JSON.parse(data);
    console.log(data);
    switch (data.type) {
      case "CONNECTION_ESTABLISHED":
        connectionId = data.connectionId;
        // set username

        axios
          .get("/process/set-username", {
            params: {
              connectionId,
              username,
            },
          })
          .then((x) => {
            console.log("username is successfully set");
          })
          .catch(() => {
            console.error("setting username failed!");
          });

        break;
    }
  };

  render("pages/main.html", { username });
});

function QueryStringToJSON(str) {
  var pairs = str.split("&");
  var result = {};
  pairs.forEach(function (pair) {
    pair = pair.split("=");
    var name = pair[0];
    var value = pair[1];
    if (name.length)
      if (result[name] !== undefined) {
        if (!result[name].push) {
          result[name] = [result[name]];
        }
        result[name].push(value || "");
      } else {
        result[name] = value || "";
      }
  });
  return result;
}

function getQueryVariable(query, key) {
  var vars = query.split("&");
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split("=");
    if (decodeURIComponent(pair[0]) == key) {
      return decodeURIComponent(pair[1]);
    }
  }
  console.log("Query variable %s not found", key);
}

async function render(path, context = {}) {
  const template = await loadTemplate(path);
  const html = Handlebars.compile(template)(context);
  $("#root").html(html);
}

function computeDist(userlat, userlong, hostlat, hostlong) {
  let dist =
    Math.acos(
      Math.sin(userlat) * Math.sin(hostlat) +
        Math.cos(userlat) * Math.cos(hostlat) * Math.cos(userlong - hostlong)
    ) * 6371;

  return dist * 1000;
}

function joinRoomAsModerator(roomId) {
  setRoom(roomId);
  axios
    .get("/process/set-moderator", { params: { roomId, connectionId } })
    .then(() => {
      render("pages/moderator.html");
    })
    .catch((e) => {
      console.error(e);
      alert("조인하기에 실패했습니다");
    });
}

function joinRoomAsListener(roomId) {
  setRoom(roomId);
  axios
    .get("/process/join-room", { params: { roomId, connectionId } })
    .then(() => {
      render("pages/listener.html");
    })
    .catch((e) => {
      console.error(e);
      alert("조인하기에 실패했습니다");
    });
}



