#!/usr/bin/env python3
"""Assemble daifugo.html from src/ (template + css/*.css + js/*.js, filename order).
Usage: python3 build.py [--out PATH]"""
import argparse, glob, os
R = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('--out', default=os.path.join(R, 'daifugo.html'))
a = ap.parse_args()
def cat(sub, ext):
    fs = sorted(glob.glob(os.path.join(R, 'src', sub, '*.' + ext)))
    return ''.join(open(f, encoding='utf8', newline='').read() for f in fs)
t = open(os.path.join(R, 'src', 'index.template.html'), encoding='utf8', newline='').read()
for mark in ('/*@@CSS@@*/\n', '/*@@JS@@*/\n'):
    assert t.count(mark) == 1, mark
t = t.replace('/*@@CSS@@*/\n', cat('css', 'css')).replace('/*@@JS@@*/\n', cat('js', 'js'))
open(a.out, 'w', encoding='utf8', newline='').write(t)
print('wrote', a.out, len(t.encode()), 'bytes')
