import os
import sys

# Set environment
os.environ['HOME'] = os.environ['USERPROFILE']
os.environ['AIREFINERY_API_KEY'] = 'u7qV4d2WulHEQ3UAIW5f258zjU1M5SAq-hUKVQy6Kbs='

# Run llms
sys.argv = ['llms', '--serve', '8001']

from llms.main import main
main()
