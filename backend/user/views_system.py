"""
System management API views for git operations and system updates.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
import logging
import subprocess
import os
from pathlib import Path

logger = logging.getLogger(__name__)


class AppUpdateView(APIView):
    """
    API endpoint to pull updates from GitHub estatelink-testing branch.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            # Get the project root directory
            # BASE_DIR points to backend/ directory, so we go up one level to get project root
            base_dir = Path(settings.BASE_DIR).resolve()
            project_root = base_dir.parent
            
            # Verify .git directory exists
            git_dir = project_root / '.git'
            if not git_dir.exists():
                return Response(
                    {
                        'success': False,
                        'error': 'Git repository not found. Please ensure the project is a git repository.',
                        'errors': ['Git repository not found at project root']
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Verify git command is available
            try:
                git_check = subprocess.run(
                    ['git', '--version'],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if git_check.returncode != 0:
                    return Response(
                        {
                            'success': False,
                            'error': 'Git command not available',
                            'errors': ['Git is not installed or not in PATH']
                        },
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
            except FileNotFoundError:
                return Response(
                    {
                        'success': False,
                        'error': 'Git command not found',
                        'errors': ['Git is not installed or not in PATH']
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            except Exception as e:
                logger.warning(f"Could not verify git: {str(e)}")
            
            branch = request.data.get('branch', 'estatelink-testing')
            
            # Validate branch name to prevent command injection
            if not branch.replace('-', '').replace('_', '').isalnum():
                return Response(
                    {'error': 'Invalid branch name'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            results = {
                'success': True,
                'messages': [],
                'errors': [],
                'branch': branch
            }
            
            # Step 1: Fetch latest changes from remote
            try:
                fetch_result = subprocess.run(
                    ['git', 'fetch', 'origin', branch],
                    capture_output=True,
                    text=True,
                    timeout=60,
                    cwd=str(project_root)
                )
                
                if fetch_result.returncode != 0:
                    error_msg = fetch_result.stderr.strip() or fetch_result.stdout.strip() or "Unknown error"
                    results['errors'].append(f"Git fetch failed: {error_msg}")
                    results['success'] = False
                    logger.error(f"Git fetch failed: {error_msg}")
                else:
                    results['messages'].append("Successfully fetched latest changes from remote")
            except subprocess.TimeoutExpired:
                results['errors'].append("Git fetch timed out after 60 seconds")
                results['success'] = False
            except Exception as e:
                error_msg = str(e)
                results['errors'].append(f"Error during git fetch: {error_msg}")
                results['success'] = False
                logger.error(f"Git fetch error: {error_msg}", exc_info=True)
            
            # Step 2: Check current branch
            try:
                current_branch_result = subprocess.run(
                    ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
                    capture_output=True,
                    text=True,
                    timeout=10,
                    cwd=str(project_root)
                )
                
                current_branch = current_branch_result.stdout.strip() if current_branch_result.returncode == 0 else 'unknown'
                results['current_branch'] = current_branch
                results['messages'].append(f"Current branch: {current_branch}")
            except Exception as e:
                logger.warning(f"Could not determine current branch: {str(e)}")
                results['current_branch'] = 'unknown'
                results['messages'].append(f"Warning: Could not determine current branch: {str(e)}")
            
            # Step 3: Pull changes from the specified branch
            try:
                # First, check if we need to switch branches
                if results.get('current_branch') != branch:
                    # Checkout the branch
                    checkout_result = subprocess.run(
                        ['git', 'checkout', branch],
                        capture_output=True,
                        text=True,
                        timeout=30,
                        cwd=str(project_root)
                    )
                    
                    if checkout_result.returncode != 0:
                        error_msg = checkout_result.stderr.strip() or checkout_result.stdout.strip() or "Unknown error"
                        results['errors'].append(f"Failed to checkout branch {branch}: {error_msg}")
                        results['success'] = False
                        logger.error(f"Git checkout failed: {error_msg}")
                    else:
                        results['messages'].append(f"Switched to branch: {branch}")
                
                # Pull the latest changes
                pull_result = subprocess.run(
                    ['git', 'pull', 'origin', branch],
                    capture_output=True,
                    text=True,
                    timeout=120,
                    cwd=str(project_root)
                )
                
                if pull_result.returncode != 0:
                    error_msg = pull_result.stderr.strip() or pull_result.stdout.strip() or "Unknown error"
                    results['errors'].append(f"Git pull failed: {error_msg}")
                    results['success'] = False
                    logger.error(f"Git pull failed: {error_msg}")
                else:
                    results['messages'].append("Successfully pulled latest changes")
                    results['pull_output'] = pull_result.stdout
                    
                    # Get the latest commit info
                    try:
                        commit_result = subprocess.run(
                            ['git', 'log', '-1', '--pretty=format:%H|%an|%ae|%ad|%s', '--date=iso'],
                            capture_output=True,
                            text=True,
                            timeout=10,
                            cwd=str(project_root)
                        )
                        
                        if commit_result.returncode == 0:
                            commit_info = commit_result.stdout.strip().split('|')
                            if len(commit_info) == 5:
                                results['latest_commit'] = {
                                    'hash': commit_info[0],
                                    'author': commit_info[1],
                                    'email': commit_info[2],
                                    'date': commit_info[3],
                                    'message': commit_info[4]
                                }
                    except Exception as e:
                        logger.warning(f"Could not get commit info: {str(e)}")
                        
            except subprocess.TimeoutExpired:
                results['errors'].append("Git pull timed out")
                results['success'] = False
            except Exception as e:
                results['errors'].append(f"Error during git pull: {str(e)}")
                results['success'] = False
                logger.error(f"Git pull error: {str(e)}")
            
            # Step 4: Get status to show if there are uncommitted changes
            try:
                status_result = subprocess.run(
                    ['git', 'status', '--porcelain'],
                    capture_output=True,
                    text=True,
                    timeout=10,
                    cwd=str(project_root)
                )
                
                if status_result.returncode == 0:
                    uncommitted = status_result.stdout.strip()
                    if uncommitted:
                        results['messages'].append("Warning: There are uncommitted changes in the repository")
                        results['uncommitted_changes'] = uncommitted.split('\n')
                    else:
                        results['messages'].append("Repository is clean (no uncommitted changes)")
            except Exception as e:
                logger.warning(f"Could not get git status: {str(e)}")
            
            # Always return a response, even if there were errors
            # If there are errors but also some success, return 200 with warnings
            if results['success'] and len(results['errors']) == 0:
                return Response(results, status=status.HTTP_200_OK)
            elif results['success'] and len(results['errors']) > 0:
                # Partial success - return 200 but include errors
                return Response(results, status=status.HTTP_200_OK)
            else:
                # Complete failure - return 500
                return Response(results, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except subprocess.TimeoutExpired as e:
            error_msg = f"Operation timed out: {str(e)}"
            logger.error(f"Timeout in app update: {error_msg}", exc_info=True)
            return Response(
                {
                    'success': False,
                    'error': 'Update operation timed out',
                    'errors': [error_msg, 'The git operation took too long to complete'],
                    'messages': []
                },
                status=status.HTTP_408_REQUEST_TIMEOUT
            )
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Error in app update: {error_msg}", exc_info=True)
            return Response(
                {
                    'success': False,
                    'error': f'Failed to update app: {error_msg}',
                    'errors': [error_msg],
                    'messages': []
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

