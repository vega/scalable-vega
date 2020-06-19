# Scalable Vega

A demo of how to scale Vega to millions of records. Try it out at https://vega.github.io/scalable-vega/.

The way we implemented this demo is with a custom transform that accepts SQL queries and requests data from a database with the [Vega Transform to Query OmniSciDB](https://github.com/omnisci/vega-transform-omnisci-core). You could implement this demo with any other database backend as long as it has an API you can call from your browser. In our demo, we constructed the queries with Vega signals so we can create dynamic queries.

## Deployment

We are automatically deploying with [GitHub Actions](https://github.com/features/actions) to [GitHub Pages](https://pages.github.com/) whenever there is a commit on master.
