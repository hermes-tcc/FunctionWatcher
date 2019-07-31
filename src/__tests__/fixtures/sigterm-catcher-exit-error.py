#!/usr/bin/env python3
from time import sleep
import signal
import sys

def sigterm_handler(_signo, _stack_frame):
    print("{} RECEIVED".format(_signo))
    sys.exit(1)

signal.signal(signal.SIGTERM, sigterm_handler)
print("Sleep 30 seconds")
sys.stdout.flush()
sleep(30)
print("Done sleeping")
sys.stdout.flush()
