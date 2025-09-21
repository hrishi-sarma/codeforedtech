#!/usr/bin/env python3
"""
Startup script to run both Job Description Parser (port 8000) and PDF Processing (port 8001) servers
"""

import subprocess
import sys
import time
import signal
import os
from pathlib import Path

# Get the server directory
SERVER_DIR = Path(__file__).parent

def start_server(server_file, port, server_name):
    """Start a FastAPI server"""
    try:
        print(f"🚀 Starting {server_name} on port {port}...")
        
        # Start the server process
        process = subprocess.Popen([
            sys.executable, "-m", "uvicorn", 
            f"{server_file}:app",
            "--host", "0.0.0.0",
            "--port", str(port),
            "--reload"
        ], cwd=SERVER_DIR)
        
        print(f"✅ {server_name} started successfully (PID: {process.pid})")
        return process
        
    except Exception as e:
        print(f"❌ Failed to start {server_name}: {e}")
        return None

def main():
    """Main function to start both servers"""
    print("=" * 60)
    print("🌟 Starting Job Description & PDF Processing Servers")
    print("=" * 60)
    
    processes = []
    
    try:
        # Start Job Description Parser Server (port 8000)
        job_process = start_server("job_server", 8000, "Job Description Parser")
        if job_process:
            processes.append(("Job Description Parser", job_process))
        
        # Wait a moment before starting the second server
        time.sleep(2)
        
        # Start PDF Processing Server (port 8001)
        pdf_process = start_server("pdf_server", 8001, "PDF Processing Server")
        if pdf_process:
            processes.append(("PDF Processing Server", pdf_process))
        
        if not processes:
            print("❌ No servers could be started. Exiting...")
            return
        
        print("\n" + "=" * 60)
        print("🎉 All servers started successfully!")
        print("=" * 60)
        print("📊 Server Information:")
        print("  • Job Description Parser: http://localhost:8000")
        print("    - API Docs: http://localhost:8000/docs")
        print("    - Health Check: http://localhost:8000/health")
        print("  • PDF Processing Server: http://localhost:8001")
        print("    - API Docs: http://localhost:8001/docs") 
        print("    - Health Check: http://localhost:8001/health")
        print("=" * 60)
        print("💡 Press Ctrl+C to stop all servers")
        print("=" * 60)
        
        # Keep the script running
        while True:
            # Check if any process has died
            for name, process in processes[:]:  # Create a copy of the list
                if process.poll() is not None:
                    print(f"⚠️  {name} has stopped unexpectedly")
                    processes.remove((name, process))
            
            if not processes:
                print("❌ All servers have stopped. Exiting...")
                break
                
            time.sleep(1)
    
    except KeyboardInterrupt:
        print("\n🛑 Shutdown signal received. Stopping servers...")
        
        # Stop all processes
        for name, process in processes:
            try:
                print(f"🔄 Stopping {name}...")
                process.terminate()
                process.wait(timeout=5)
                print(f"✅ {name} stopped")
            except subprocess.TimeoutExpired:
                print(f"⚠️  Force killing {name}...")
                process.kill()
            except Exception as e:
                print(f"❌ Error stopping {name}: {e}")
        
        print("👋 All servers stopped. Goodbye!")
    
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        
        # Clean up processes
        for name, process in processes:
            try:
                process.terminate()
            except:
                pass

if __name__ == "__main__":
    main()