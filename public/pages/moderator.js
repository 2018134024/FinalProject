ws.onopen = (event) => {
  console.log("open");
};

ws.onmessage = (event) => {
  // targetInput.value = event.data;
};

var tag = document.createElement("script");

tag.src = "https://www.youtube.com/iframe_api?origin=http://localhost:3001";

var firstScriptTag = document.getElementsByTagName("script")[0];

firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// 3. This function creates an <iframe> (and YouTube player)
//    after the API code downloads.
var player;
function onYouTubeIframeAPIReady() {
  let qs = new URL(currentRoom.youtubeUrl).search.slice(1);
  let qsj = QueryStringToJSON(qs);
  let playlistId = qsj["list"];
  let videoId = qsj["v"];

  console.table({ qs, qsj, videoId, playlistId });
  let isPlaylist = !!playlistId;

  if (isPlaylist) {
    player = new YT.Player("player", {
      height: "360",
      width: "640",
      playerVars: {
        listType: "playlist",
        list: playlistId,
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
      },
    });
  } else {
    player = new YT.Player("player", {
      height: "360",
      width: "640",
      videoId,
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
      },
    });
  }
}

// 4. The API will call this function when the video player is ready.
function onPlayerReady(event) {
  event.target.playVideo();
  console.log("start!!");
}

// 5. The API calls this function when the player's state changes.
//    The function indicates that when playing a video (state=1),
//    the player should play for six seconds and then stop.
var done = false;

// player state 1: play 2: stop 3:

function syncPlayerState() {
  const time = player.getCurrentTime();
  const roomId = currentRoom.id;
  const playerState = player.getPlayerState();
  ws.send(
    JSON.stringify({
      type: "sync",
      roomId,
      playerState,
      time,
      now: Date.now(),
    })
  );
}

// const syncInterval = setInterval(syncPlayerState, 10000);

function onPlayerStateChange(event) {
  syncPlayerState(event.data);
}

function stopVideo() {
  player.stopVideo();
}