---
title: Data Fetching Pipeline
summary: Built a pipeline framework for Novonesis that retrieves data from public APIs and saves it to Databricks Unity Catalog.
period: TODO
featured: true
order: 2
---


## Problem

<!-- Who had what problem, and why it mattered. 2–4 sentences. -->

Collecting data from public APIs for analytics and business intelligence is time-consuming, and without a shared framework, every team and department ends up repeating the same groundwork. This project solves that with a ready-made pipeline that fetches data from API sources: adding or changing a data source is simple, data management is already handled, and the resulting data is easy to access and use for analysis.

## Stack

<!-- One bullet per technology. Note anything used in an unusual or notable way. -->

- Python
- PySpark
- Databricks and Unity Catalog
- GitHub Actions (CI/CD)

## My role

<!-- Solo or team? If team, how big, and what exactly did YOU own? Don't overclaim. -->

Sole developer: designed and built the framework end to end during a data engineering
internship in the Novonesis Data Office. Colleagues in the Data Office provided guidance.

- Reliability: error handling, logging, tests and automated scheduling.
- Delivery: CI/CD with GitHub Actions, and documentation so the team can maintain and
  extend the framework.

## Results

<!--
Quantify where you can: "cut p95 latency from 1.2s to 300ms", "reduced manual review
by 40%", "200 weekly users". If there are no numbers, say what shipped and who used it.
-->

Shipped the framework to production, along with a monitoring dashboard that tracks pipeline health and data freshness at a glance, and set up automatic email alerts whenever a pipeline run fails.

## Links

<!-- Live demo, source code, write-up. Don't link private repos. If there's nothing public, write "No public links." -->

No public links, since it is proprietary software owned by Novonesis.
