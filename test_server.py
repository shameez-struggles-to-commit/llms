import os
import sys

# Set environment
os.environ['HOME'] = os.environ['USERPROFILE']
os.environ['AIREFINERY_API_KEY'] = 'u7qV4d2WulHEQ3UAIW5f258zjU1M5SAq-hUKVQy6Kbs='

# Add verbose logging
os.environ['VERBOSE'] = '1'

# Run llms
sys.argv = ['llms', '--serve', '8001']

try:
    from llms.main import main
    main()
except SystemExit as e:
    print(f"SystemExit: {e.code}")
    if e.code != 0:
        import traceback
        traceback.print_exc()
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
