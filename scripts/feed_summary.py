#!/usr/bin/env python3
"""Write source-specific workflow results without tokens or source payloads."""
import os
from pathlib import Path

SOURCES = [('RSS_RESULT', 'Betting Antelope writing'),
           ('NEWSLETTER_RESULT', 'Daily newsletter'),
           ('READ_LATER_RESULT', 'Read Later'),
           ('DOMAINS_RESULT', "What I've Built"),
           ('WATCH_RESULT', 'Watch or Listen Later')]


def summary(env):
    rows = ['## Channel sync results', '', '| Channel | Result |', '| --- | --- |']
    for key, label in SOURCES:
        outcome = env.get(key, '')
        if outcome in ('', 'skipped'):
            continue
        result = 'Synced' if outcome == 'success' else 'Not refreshed — previous snapshot kept'
        rows.append(f'| {label} | {result} |')
    rows += ['', 'A source failure does not stop the other channel job. See Publish changed snapshots for the publication result.', '']
    return '\n'.join(rows)


if __name__ == '__main__':
    with Path(os.environ['GITHUB_STEP_SUMMARY']).open('a') as target:
        target.write(summary(os.environ))
