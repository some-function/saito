// @ts-nocheck
if (typeof Storage !== "undefined") {
  const mySource = document.currentScript.src;
  const sscript = document.getElementById("saito");
  let data = null;
  let options = null;
  let bundle = null;

  data = localStorage.getItem("options");
  if (data) {
    options = JSON.parse(data);
  }
  if (options) {
    bundle = options.bundle;
  }

  if (bundle != null && bundle != "") {
    console.log("Bundle is: " + bundle);

    if (bundle != mySource) {
      console.log("removing old script");

      document.body.removeChild(sscript);

      const sscript2 = document.createElement("script");
      sscript2.onload = function () {};
      sscript2.src = bundle;
      document.body.appendChild(sscript2);

      throw new Error("Exiting before we load bad javascript...!");
    }
  }
}
