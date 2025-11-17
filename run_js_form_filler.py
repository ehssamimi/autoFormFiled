"""
Python wrapper to run JavaScript form filler
This file allows you to run formFiller.js from Python and integrate it into other tools
"""

import subprocess
import os
import sys
import tempfile
import re
from pathlib import Path
from typing import Optional, Dict, Any


class JSFormFillerRunner:
    """
    Python wrapper class to run JavaScript form filler
    Can be easily integrated into other Python tools
    """
    
    def __init__(self, js_file_path: str = "formFiller.js", config_path: str = "config.json"):
        """
        Initialize the runner
        
        Args:
            js_file_path: Path to formFiller.js file
            config_path: Path to config.json file
        """
        self.js_file_path = Path(js_file_path)
        self.config_path = Path(config_path)
        self.project_root = Path(__file__).parent
        
        # Validate files exist
        if not self.js_file_path.exists():
            raise FileNotFoundError(f"JavaScript file not found: {self.js_file_path}")
        if not self.config_path.exists():
            raise FileNotFoundError(f"Config file not found: {self.config_path}")
    
    def run(self, url: str, auto_submit: bool = False, timeout: int = 300, debug: bool = False) -> Dict[str, Any]:
        """
        Run the JavaScript form filler with specified URL
        
        Args:
            url: URL of the form to fill
            auto_submit: Whether to automatically submit the form
            timeout: Maximum execution time in seconds
            debug: If True, keep temp file and print debug info
        
        Returns:
            dict: Result with success status, stdout, stderr
        """
        # Create temporary modified JS file with the URL
        temp_js_file = self._create_temp_js_file(url, auto_submit)
        
        if debug:
            print(f"DEBUG: Temporary JS file created: {temp_js_file}")
            # Read and show first few lines of temp file
            with open(temp_js_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                print(f"DEBUG: First 20 lines of temp file:")
                for i, line in enumerate(lines[:20], 1):
                    print(f"  {i}: {line.rstrip()}")
        
        try:
            # Use absolute path for temp file
            temp_js_absolute = temp_js_file.resolve()
            config_absolute = self.config_path.resolve() if not self.config_path.is_absolute() else self.config_path
            
            # Change to project directory to ensure relative paths work
            original_dir = os.getcwd()
            os.chdir(self.project_root)
            
            try:
                # Run Node.js script with absolute path
                # Set environment to ensure Node can find modules
                env = os.environ.copy()
                env['NODE_PATH'] = str(self.project_root)
                # Pass URL and auto_submit via environment variables as backup
                env['FORM_URL'] = url
                env['AUTO_SUBMIT'] = 'true' if auto_submit else 'false'
                
                # Run Node.js script - output will be shown in real-time
                # Use subprocess.run but don't capture output so we can see logs
                print(f"\n[INFO] Running JavaScript file: {temp_js_absolute.name}")
                print(f"[INFO] URL: {url}")
                print(f"[INFO] Auto submit: {auto_submit}")
                print("[INFO] JS logs will appear below:\n")
                print("=" * 60)
                
                result = subprocess.run(
                    ['node', str(temp_js_absolute), url, 'true' if auto_submit else 'false'],
                    text=True,
                    encoding='utf-8',
                    errors='replace',
                    timeout=timeout,
                    cwd=str(self.project_root),
                    env=env
                )
                
                print("=" * 60)
                print(f"\n[INFO] Process finished with return code: {result.returncode}")
                
                return {
                    'success': result.returncode == 0,
                    'returncode': result.returncode,
                    'stdout': '',  # Output was printed directly
                    'stderr': '',  # Errors were printed directly
                    'url': url,
                    'auto_submit': auto_submit
                }
            finally:
                os.chdir(original_dir)
                
        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'error': f'Execution timeout after {timeout} seconds',
                'url': url
            }
        except FileNotFoundError:
            return {
                'success': False,
                'error': 'Node.js is not installed. Please install Node.js first.',
                'url': url
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'url': url
            }
        finally:
            # Clean up temporary file (unless debug mode)
            if not debug and temp_js_file.exists():
                try:
                    temp_js_file.unlink()
                except Exception as e:
                    if debug:
                        print(f"DEBUG: Could not delete temp file: {e}")
            elif debug:
                print(f"DEBUG: Temp file kept at: {temp_js_file}")
    
    def _create_temp_js_file(self, url: str, auto_submit: bool) -> Path:
        """
        Create a temporary JS file with the specified URL
        Creates a complete copy of the original file with only main function modified
        
        Args:
            url: URL to use in the JS file
            auto_submit: Whether to auto submit
        
        Returns:
            Path to temporary JS file
        """
        # Read original JS file completely
        with open(self.js_file_path, 'r', encoding='utf-8') as f:
            js_content = f.read()
        
        # Escape URL for JavaScript string (handle quotes and backslashes)
        escaped_url = url.replace('\\', '\\\\').replace("'", "\\'").replace('"', '\\"')
        auto_submit_str = 'true' if auto_submit else 'false'
        
        # Create new main function that uses environment variables or arguments
        new_main = f"""async function main() {{
    // Initialize form filler
    const filler = new FormFiller('{self.config_path}');
    
    // Get URL from environment variable, process argument, or fallback
    const url = process.env.FORM_URL || process.argv[2] || '{escaped_url}';
    // Parse autoSubmit - check all possible sources
    const autoSubmitEnv = process.env.AUTO_SUBMIT;
    const autoSubmitArg = process.argv[3];
    const autoSubmit = autoSubmitEnv === 'true' || autoSubmitArg === 'true' || {auto_submit_str};
    
    console.log('📋 Form Filler Configuration:');
    console.log('   URL:', url);
    console.log('   Auto Submit (from env):', autoSubmitEnv);
    console.log('   Auto Submit (from arg):', autoSubmitArg);
    console.log('   Auto Submit (final):', autoSubmit);
    console.log('   Config:', '{self.config_path}');
    console.log('');
    
    // Fill the form - make sure autoSubmit is passed correctly
    console.log('🚀 Starting form fill with autoSubmit =', autoSubmit);
    await filler.fillForm(url, autoSubmit);
}}"""
        
        # Find and replace the main function more carefully
        # Look for the exact pattern: async function main() { ... } followed by main().catch()
        main_pattern = r'async function main\(\) \{[\s\S]*?\n\}\n\n// Run the script\nmain\(\)\.catch\(console\.error\);'
        
        # Try to match the pattern
        match = re.search(main_pattern, js_content)
        if match:
            # Replace the matched main function
            modified_content = js_content[:match.start()] + new_main + '\n\n// Run the script\nmain().catch(console.error);' + js_content[match.end():]
        else:
            # Fallback: find main function start and end manually
            lines = js_content.split('\n')
            new_lines = []
            skip_until_catch = False
            main_found = False
            
            for i, line in enumerate(lines):
                if 'async function main()' in line and not main_found:
                    main_found = True
                    skip_until_catch = True
                    # Add new main function
                    new_lines.extend(new_main.split('\n'))
                    continue
                elif skip_until_catch:
                    if 'main().catch(console.error);' in line:
                        skip_until_catch = False
                        new_lines.append('// Run the script')
                        new_lines.append('main().catch(console.error);')
                    # Skip old main function content
                    continue
                else:
                    new_lines.append(line)
            
            modified_content = '\n'.join(new_lines)
        
        # Create temporary file in the same directory as original JS file
        # This ensures relative imports (./modules/...) work correctly
        js_file_dir = self.js_file_path.resolve().parent
        temp_file_path = js_file_dir / 'formFiller_temp.js'
        
        # Write complete modified content to temp file
        with open(temp_file_path, 'w', encoding='utf-8') as f:
            f.write(modified_content)
        
        return temp_file_path
    
    def check_dependencies(self) -> Dict[str, Any]:
        """
        Check if required dependencies are installed
        
        Returns:
            dict: Status of Node.js and npm
        """
        result = {
            'nodejs': False,
            'npm': False
        }
        
        # Check Node.js
        try:
            node_result = subprocess.run(
                ['node', '--version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            result['nodejs'] = node_result.returncode == 0
            if result['nodejs']:
                result['nodejs_version'] = node_result.stdout.strip()
        except:
            pass
        
        # Check npm
        try:
            npm_result = subprocess.run(
                ['npm', '--version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            result['npm'] = npm_result.returncode == 0
            if result['npm']:
                result['npm_version'] = npm_result.stdout.strip()
        except:
            pass
        
        return result


# ============================================
# Simple function interface for easy use
# ============================================
def fill_form(url: str, auto_submit: bool = False, config_path: str = "config.json", debug: bool = False) -> Dict[str, Any]:
    """
    Simple function to fill a form using JavaScript form filler
    
    Args:
        url: URL of the form to fill
        auto_submit: Whether to automatically submit the form
        config_path: Path to config.json file
    
    Returns:
        dict: Result with success status and output
    
    Example:
        result = fill_form("https://example.com/form", auto_submit=False)
        if result['success']:
            print("Form filled successfully!")
    """
    runner = JSFormFillerRunner(config_path=config_path)
    return runner.run(url, auto_submit=auto_submit, debug=debug)


# ============================================
# Example usage
# ============================================
if __name__ == "__main__":
    # Check dependencies
    runner = JSFormFillerRunner()
    deps = runner.check_dependencies()
    
    print("Dependency Check:")
    print(f"  Node.js: {'[OK]' if deps['nodejs'] else '[FAIL]'} {deps.get('nodejs_version', 'Not installed')}")
    print(f"  npm: {'[OK]' if deps['npm'] else '[FAIL]'} {deps.get('npm_version', 'Not installed')}")
    print()
    
    if not deps['nodejs']:
        print("[ERROR] Node.js is required. Please install Node.js first.")
        sys.exit(1)
    
    # Example: Fill a form
    url = 'https://www.heckertsolar.com/vertriebsaussendienst-m-w-d-dtld.-suedost/sw10146#custom-form-anchor'
    
    print(f"[INFO] Starting form filling for: {url}")
    print()
    
    result = fill_form(url, auto_submit=False, debug=False)
    
    if result['success']:
        print("[SUCCESS] Form filled successfully!")
        if result['stdout']:
            print("\nOutput:")
            print(result['stdout'])
    else:
        print("[ERROR] Form filling failed!")
        if result.get('error'):
            print(f"Error: {result['error']}")
        if result.get('stderr'):
            print(f"\nError output:")
            print(result['stderr'])

