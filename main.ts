import "@mapd/connector/dist/browser-connector";
import embed from "vega-embed";
import { Spec } from "vega";

const connection = new (window as any).MapdCon()
  .protocol("https")
  .host("metis.mapd.com")
  .port("443")
  .dbName("mapd")
  .user("mapd")
  .password("HyperInteractive");

async function run() {
  const session = await connection.connectAsync();

  const table = "flights_donotmodify";

  const result = await session.queryAsync(
    `select airtime as "value" from ${table} where airtime is not null limit 1000`
  );

  console.log(result);

  const { view } = await embed("#view", spec);

  view.insert("source", result).run();
}

const spec: Spec = {
  $schema: "https://vega.github.io/schema/vega/v4.json",
  autosize: "pad",
  padding: 5,
  width: 600,
  height: 250,
  data: [
    { name: "source" },
    {
      name: "table",
      source: "source",
      transform: [
        {
          type: "extent",
          field: "value",
          signal: "extent"
        },
        {
          type: "bin",
          field: "value",
          as: ["bin_start", "bin_end"],
          signal: "bins",
          maxbins: 20,
          extent: { signal: "extent" }
        },
        {
          type: "aggregate",
          groupby: ["bin_start", "bin_end"],
          ops: ["count"],
          fields: ["*"],
          as: ["cnt"]
        }
      ]
    }
  ],
  marks: [
    {
      name: "marks",
      type: "rect",
      style: ["bar"],
      from: { data: "table" },
      encode: {
        update: {
          fill: [
            {
              test:
                'datum["bin_start"] === null || isNaN(datum["bin_start"]) || datum["cnt"] === null || isNaN(datum["cnt"])',
              value: null
            },
            { value: "#4c78a8" }
          ],
          x2: { scale: "x", field: "bin_start", offset: 1 },
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
        data: "table",
        fields: ["bin_start", "bin_end"]
      },
      range: [0, { signal: "width" }],
      zero: false
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
      title: "Binned Value",
      labelFlush: true,
      labelOverlap: true,
      values: {
        signal: "sequence(bins.start, bins.stop + bins.step, bins.step)"
      }
    },
    {
      scale: "y",
      orient: "left",
      grid: true,
      title: "Count of Records",
      labelOverlap: true
    }
  ],
  config: { axisY: { minExtent: 30 } }
};

run();
