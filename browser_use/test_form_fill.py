"""
Test script for form filling
"""

import asyncio
import sys
from pathlib import Path

# Add browser_use to path
sys.path.insert(0, str(Path(__file__).parent))

from browser_use import Agent
from browser_use.browser_use_form_tools import tools


async def main():
    """Main test function"""
    url = 'https://www.finest-jobs.com/Bewerbung/Sales-Manager-D-Online-Marketing-727662?cp=BA'
    
    print(f"🚀 Starting form filling for: {url}\n")
    
    # Initialize Browser-Use Agent
    agent = Agent(
        task=f"Fill the web form at {url} with data from config.json",
        tools=tools
    )
    
    # Run the agent
    try:
        result = await agent.run(url)
        print(f"\n✅ Result: {result}")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())

