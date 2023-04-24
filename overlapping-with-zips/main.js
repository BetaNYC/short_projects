/* 

1. Load map and layers. Show only the zipcodes layer by default
2. Listen for inputs to show other layers (city council will be on by default)
3. Read the text input box to hightlight certain zipcodes,
    and this should update when a submit button is clicked

*/

let zipcodeData = null;
const map = new maplibregl.Map({
  container: "map",
  style:
    "https://api.maptiler.com/maps/dataviz/style.json?key=1jzOl3SsjI6McCmXXNFt",
  center: [-73.96156, 40.706411],
  zoom: 11,
});

const layers = [
  {
    id: "ZIPCODE",
    name: "Zipcode Boundries",
    details: "Generalized ploygons of where the zipcodes are.",
    location: "./bounds/zipcode.json",
    color: "rgba(80,80,80,0.7)",
    strokeWidth: 2,
    strokeOpacity: 0.4,
    "line-dasharray": [4, 2],
    enabled: true,
  },
  {
    id: "CounDist",
    name: "City Council Districts",
    details: "Current / 2020",
    location: "./bounds/nycc_20a.json",
    color: "#e41a1c",
    strokeWidth: 1,
    strokeOpacity: 0.9,
    enabled: true,
  },
  {
    id: "AssemDist",
    name: "State Assembly Districts",
    details: "2022",
    location: "./bounds/nyad_22c.json",
    color: "#377eb8",
    strokeWidth: 1,
    strokeOpacity: 0.9,
    enabled: false,
  },
  {
    id: "StSenDist",
    name: "State Senate Districts",
    details: "2022",
    location: "./bounds/nyss_22c.json",
    color: "#4daf4a",
    strokeWidth: 1,
    strokeOpacity: 0.9,
    enabled: false,
  },
];

function findPolylabel(feature) {
  let output = [];
  if (feature.geometry.type === "Polygon") {
    output = turf.centroid(feature);
  } else {
    let maxArea = 0,
      maxPolygon = [];
    for (let i = 0, l = feature.geometry.coordinates.length; i < l; i++) {
      const p = feature.geometry.coordinates[i];
      const area = turf.area({ type: "Polygon", coordinates: p });
      if (area > maxArea) {
        maxPolygon = p;
        maxArea = area;
      }
    }
    output = turf.centroid({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: maxPolygon },
    });
  }
  return output;
}

async function loadLayers(obj) {
  const data = await (await fetch(obj.location)).json();
  map.addSource(obj.id, {
    type: "geojson",
    data,
  });

  const paint = {
    "line-color": obj.color,
    "line-opacity": obj.strokeOpacity,
    "line-width": obj.strokeWidth,
  };

  if (obj["line-dasharray"]) paint["line-dasharray"] = obj["line-dasharray"];

  map.addLayer({
    id: obj.id,
    type: "line",
    source: obj.id,
    layout: {},
    paint,
  });

  //generate labels
  const label_features = data.features.map((feature) => {
    const centroid = findPolylabel(feature);
    centroid.properties = feature.properties;
    return centroid;
  });

  map.addSource(obj.id + "-label", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: label_features,
    },
  });
  let layout = {
    "text-field": ["get", obj.id],
    "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 32, 25],
    "text-font": [
      "literal",
      ["DIN Offc Pro Narrow", "Arial Unicode MS Regular"],
    ],
  };

  //make every layer that isn't zipcodes have larger font and overlap things
  if (obj.id !== "ZIPCODE") {
    layout = {
      ...layout,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
      "text-size": ["interpolate", ["linear"], ["zoom"], 11, 12.5, 32, 60],
    };
  }

  map.addLayer({
    id: obj.id + "-label",
    type: "symbol",
    source: obj.id + "-label",
    layout,
    paint: {
      "text-color": obj.color,
      "text-halo-color": "rgba(255,255,255,0.9)",
      "text-halo-width": 2,
    },
  });

  //hide layers
  if (!obj.enabled) {
    map.setLayoutProperty(obj.id, "visibility", "none");
    map.setLayoutProperty(obj.id + "-label", "visibility", "none");
  }

  const toggle = document.createElement("div");
  const label = document.createElement("label");
  label.setAttribute("for", obj.id);
  label.innerText = obj.name;
  const input = document.createElement("input");
  input.setAttribute("name", obj.id);
  input.setAttribute("type", "checkbox");
  input.addEventListener("change", (event) => {
    const checked = event.target.checked;
    if (checked) {
      map.setLayoutProperty(obj.id, "visibility", "visible");
      map.setLayoutProperty(obj.id + "-label", "visibility", "visible");
    } else {
      map.setLayoutProperty(obj.id, "visibility", "none");
      map.setLayoutProperty(obj.id + "-label", "visibility", "none");
    }
  });
  if (obj.enabled) input.setAttribute("checked", true);

  toggle.appendChild(label);
  toggle.appendChild(input);
  layerToggles.appendChild(toggle);

  //add an extra fill layer for zipcodes
  if (obj.id === "ZIPCODE") {
    map.addLayer({
      id: "ZIPCODE-fill",
      type: "fill",
      source: "ZIPCODE",
      paint: {
        "fill-color": "#f0e130",
        "fill-opacity": ["match", ["get", "selected"], "yes", 0.6, 0],
      },
    });
    zipcodeData = data;
    hightlightZipcodes(localStorage.getItem("zipcodes") ?? default_values);
  }
}

const layerToggles = document.getElementById("layer-toggles");

map.on("load", function () {
  layers.map(loadLayers);
});

//default zipcodes-textarea to these or read from browser
const textarea = document.getElementById("zipcodes-textarea");
const default_values = `
10001
10002
10009
10025
10026
10027
10029
10030
10031
10032
10033
10034
10035
10037
10038
10039
10040
10301
10302
10303
10304
10310
10451
10452
10453
10454
10455
10456
10457
10458
10459
10460
10462
10463
10466
10467
10468
10472
10473
10474
11101
11102
11106
11203
11204
11205
11206
11207
11208
11211
11212
11213
11214
11216
11218
11219
11220
11221
11223
11224
11225
11226
11230
11232
11233
11235
11237
11239
11354
11355
11368
11369
11373
11416
11417
11418
11430
11432
11433
11435
11691
11692
`.trim();

textarea.value = localStorage.getItem("zipcodes") ?? default_values;

function hightlightZipcodes(selectedZipcodes = "") {
  const zipcodeList = selectedZipcodes.split('\n').filter(i => i.length === 5)
  if (zipcodeData) {
   //add properties selected: yes
    const features = JSON.parse(JSON.stringify(zipcodeData.features)).map(feature => {
        if(zipcodeList.includes(feature.properties.ZIPCODE)){
            feature.properties.selected = 'yes'
        }
        return feature
    })
    map.getSource("ZIPCODE").setData({type: "FeatureCollection", features});
    textarea.value = selectedZipcodes
  }
}

const form = document.getElementById("zipcode-form");
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const selectedZipcodes = textarea.value;
  localStorage.setItem("zipcodes", selectedZipcodes);
  hightlightZipcodes(selectedZipcodes);
});
