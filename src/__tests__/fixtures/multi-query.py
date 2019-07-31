#!/usr/bin/env python3
from time import sleep
import sys

s = input()
while s == "s": 
  print("Continue")
  sys.stdout.flush()
  s = input()
print("Done")
sys.stdout.flush()

