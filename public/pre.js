function startApp() {
  const username = document.querySelector("#index_input_1").value;
  window.location.href = `/app.html?username=${username}`;
}