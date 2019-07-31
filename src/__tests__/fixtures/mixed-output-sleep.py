#!/usr/bin/env python3
from time import sleep
import sys

[commonBytes, additionalStdoutBytes, additionalStderrBytes] = map(int, input().split(' '))
sys.stdout.write('.' * commonBytes)
sys.stderr.write('.' * commonBytes)
sys.stdout.flush()
sys.stderr.flush()
sys.stdout.write('+' * additionalStdoutBytes)
sys.stderr.write('+' * additionalStderrBytes)
sys.stdout.flush()
sys.stderr.flush()

sleep(30)
