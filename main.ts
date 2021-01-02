import * as vega from "vega";
import QueryCore from "vega-transform-omnisci-core";
import "@mapd/connector/dist/browser-connector";

const connection = new (window as any).MapdCon()
  .protocol("https")
  .host("metis.mapd.com")
  .port("443")
  .dbName("mapd")
  .user("mapd")
  .password("HyperInteractive");

const table = "flights_donotmodify";

connection.connectAsync().then(session => {
  // assign session to OmniSci Core transform
  QueryCore.session(session);

  // add core transforms
  vega.transforms["querycore"] = QueryCore;

  const runtime = vega.parse(spec);
  const view = new vega.View(runtime)
    .logLevel(vega.Info)
    .renderer("svg")
    .initialize(document.querySelector("#view"));

  view.runAsync();

  // assign view and vega to window so we can debug them
  window["vega"] = vega;
  window["view"] = view;
});

// transform to compute the extent
const extent = {
  type: "querycore",
  query: {
    signal: `'select min(' + field + ') as "min", max(' + field + ') as "max" from ${table}'`
  }
} as any;

// bin and aggregate
const data = {
  type: "querycore",
  query: {
    signal: `'select ' + bins.step + ' * floor((' + field + '-cast(' + bins.start + ' as float))/' + bins.step + ') as "bin_start", count(*) as "cnt" from ${table} where ' + field + ' between ' + bins.start + ' and ' + bins.stop + ' group by bin_start'`
  }
} as any;

const spec: vega.Spec = {
  $schema: "https://vega.github.io/schema/vega/v5.json",
  autosize: "pad",
  padding: 5,
  width: 600,
  height: 250,
  signals: [
    {
      name: "field",
      value: "airtime",
      bind: {
        input: "select",
        options: [
          "deptime",
          "crsdeptime",
          "arrtime",
          "crsarrtime",
          "flightnum",
          "actualelapsedtime",
          "crselapsedtime",
          "airtime",
          "arrdelay",
          "depdelay",
          "distance",
          "taxiin",
          "taxiout",
          "carrierdelay",
          "weatherdelay",
          "nasdelay",
          "securitydelay",
          "lateaircraftdelay",
          "plane_year"
        ]
      }
    },
    {
      name: "maxbins",
      value: 20,
      bind: { input: "range", min: 1, max: 300, debounce: 100 }
    }
  ],
  data: [
    {
      name: "extent",
      transform: [extent]
    },
    {
      name: "bin",
      transform: [
        // this bin transform doesn't actually bin any data, it just computea the bins signal
        {
          type: "bin",
          field: null,
          signal: "bins",
          maxbins: { signal: "maxbins" },
          extent: {
            signal:
              "data('extent') ? [data('extent')[0]['min'], data('extent')[0]['max']] : [0, 0]"
          }
        }
      ]
    },
    {
      name: "table",
      transform: [
        data,
        {
          type: "formula",
          expr: "datum.bin_start + bins.step",
          as: "bin_end"
        }
      ]
    }
  ],
  marks: [
    {
      name: "marks",
      type: "rect",
      from: { data: "table" },
      encode: {
        update: {
          fill: { value: "steelblue" },
          x2: {
            scale: "x",
            field: "bin_start",
            offset: {
              signal: "(bins.stop - bins.start)/bins.step > 150 ? 0 : 1"
            }
          },
          x: { scale: "x", field: "bin_end" },
          y: { scale: "y", field: "cnt" },
          y2: { scale: "y", value: 0 }
        }
      }
    }
  ],
  scales: [
    {
      name: "x",
      type: "linear",
      domain: {
        signal: "[bins.start, bins.stop]"
      },
      range: [0, { signal: "width" }],
      zero: false,
      bins: { signal: "bins" }
    },
    {
      name: "y",
      type: "linear",
      domain: { data: "table", field: "cnt" },
      range: [{ signal: "height" }, 0],
      nice: true,
      zero: true
    }
  ],
  axes: [
    {
      scale: "x",
      orient: "bottom",
      grid: false,
      title: {
        signal: `field`
      },
      labelFlush: true,
      labelOverlap: true
    },
    {
      scale: "y",
      orient: "left",
      grid: true,
      title: "Count of Records",
      labelOverlap: true,
      gridOpacity: 0.7
    }
  ],
  config: { axisY: { minExtent: 30 } }
};
