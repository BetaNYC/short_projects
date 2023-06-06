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
  center: [-73.79825732, 40.76059195],
  zoom: 11,
});

const layers = [
  {
    id: "ADED",
    name: "AD-ED Boundries",
    details: "Generalized ploygons of where the ad-eds are.",
    location: "./bounds/ad_ed.geojson",
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
  if (obj.id !== "ADED") {
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
  if (obj.id === "ADED") {
    map.addLayer({
      id: "ADED-fill",
      type: "fill",
      source: "ADED",
      paint: {
        "fill-color": "#f0e130",
        "fill-opacity": ["match", ["get", "selected"], "yes", 0.6, 0],
      },
    });
    zipcodeData = data;
    hightlightZipcodes(localStorage.getItem("zipcodes") ?? default_values);
  }

  // Create a popup, but don't add it to the map yet.
  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
  });

  map.on("click", "ADED-fill", (e) => {
    // Change the cursor style as a UI indicator.
    map.getCanvas().style.cursor = "pointer";

    // Copy coordinates array.
    const coordinates = turf
      .centroid(e.features[0])
      ["geometry"]["coordinates"].slice();
    const description = e.features[0].properties.ElectDist;

    // Ensure that if the map is zoomed out such that multiple
    // copies of the feature are visible, the popup appears
    // over the copy being pointed to.
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
      coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }

    // Populate the popup and set its coordinates
    // based on the feature found.
    popup.setLngLat(coordinates).setHTML(description).addTo(map);
  });

}

const layerToggles = document.getElementById("layer-toggles");

map.on("load", function () {
  layers.map(loadLayers);
});

//default zipcodes-textarea to these or read from browser
const textarea = document.getElementById("zipcodes-textarea");
const default_values = `
26-010
26-038
27-027
24-062
26-017
26-043
26-011
26-012
26-020
`.trim();

textarea.value = localStorage.getItem("zipcodes") ?? default_values;

function hightlightZipcodes(selectedZipcodes = "") {
  const zipcodeList = selectedZipcodes
    .split("\n")
    .filter((i) => i.length === 6)
    .map((d) => Number(d.replace("-", "")));
  if (zipcodeData) {
    //add properties selected: yes
    const features = JSON.parse(JSON.stringify(zipcodeData.features)).map(
      (feature) => {
        if (zipcodeList.includes(feature.properties.ElectDist)) {
          feature.properties.selected = "yes";
        }
        return feature;
      }
    );
    map.getSource("ADED").setData({ type: "FeatureCollection", features });
    textarea.value = selectedZipcodes;
  }
}

const form = document.getElementById("zipcode-form");
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const selectedZipcodes = textarea.value;
  localStorage.setItem("zipcodes", selectedZipcodes);
  hightlightZipcodes(selectedZipcodes);
});
