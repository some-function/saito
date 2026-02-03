// @ts-nocheck
if (typeof Storage !== "undefined") {
  const mySource = document.currentScript.src;
  const sscript = document.getElementById("saito");
  
  const bundle = (() => {
    const data = localStorage.getItem("options");
    if (data) {
      const options = JSON.parse(data);
      return options ? options.bundle : null;
    } else {
      return null;
    }
  })();

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