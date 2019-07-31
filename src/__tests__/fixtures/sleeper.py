#!/usr/bin/env python3
from time import sleep
import sys

s = int(input())
print("Sleep {} seconds".format(s))
sys.stdout.flush()
sleep(s)
print("Done sleeping")
sys.stdout.flush()
