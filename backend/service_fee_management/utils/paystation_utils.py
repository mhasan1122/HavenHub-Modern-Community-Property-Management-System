"""
PayStation Payment Gateway Integration Utility

This module provides functions to integrate with PayStation payment gateway
for processing service fee payments.

Sandbox Credentials:
- Merchant ID: 104-1653730183
- Password: gamecoderstorepass
- Sandbox URL: https://sandbox.paystation.com.bd
"""

import requests
import logging
from django.conf import settings
from decimal import Decimal
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)


class PayStationPaymentGateway:
    """
    PayStation Payment Gateway Integration Class
    """
    
    def __init__(self):
        # Get settings from Django settings, with sandbox defaults
        self.merchant_id = getattr(settings, 'PAYSTATION_MERCHANT_ID', '104-1653730183')
        self.password = getattr(settings, 'PAYSTATION_PASSWORD', 'gamecoderstorepass')
        self.is_sandbox = getattr(settings, 'PAYSTATION_IS_SANDBOX', True)
        
        # API endpoints (per PayStation docs: https://www.paystation.com.bd/documentation/)
        # Live API: https://api.paystation.com.bd
        # Sandbox: separate store ID; same API domain per docs
        if self.is_sandbox:
            self.base_url = 'https://sandbox.paystation.com.bd'
        else:
            self.base_url = 'https://api.paystation.com.bd'  # Live uses api subdomain
        self.initiate_api = f'{self.base_url}/initiate-payment'
        self.status_api = f'{self.base_url}/transaction-status'
        
        # Create session with connection pooling and retry strategy
        self.session = requests.Session()
        
        # Configure retry strategy
        retry_strategy = Retry(
            total=2,  # Only 2 retries for faster response
            backoff_factor=0.5,  # Shorter backoff
            status_forcelist=[429, 500, 502, 503, 504],
        )
        
        # Configure adapter with connection pooling
        adapter = HTTPAdapter(
            max_retries=retry_strategy,
            pool_connections=10,
            pool_maxsize=20
        )
        
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
    
    def init_payment(self, payment_data):
        """
        Initialize payment with PayStation
        
        Args:
            payment_data (dict): Payment information including:
                - invoice_number: Unique invoice number
                - payment_amount: Payment amount
                - currency: Currency (default: BDT)
                - reference: Reference information
                - cust_name: Customer name
                - cust_phone: Customer phone
                - cust_email: Customer email
                - cust_address: Customer address
                - callback_url: Success callback URL
                - checkout_items: Items description
        
        Returns:
            dict: Response from PayStation including payment URL
        """
        try:
            # Prepare payment request data (form-data format for PayStation)
            form_data = {
                'invoice_number': payment_data.get('invoice_number'),
                'currency': payment_data.get('currency', 'BDT'),
                'payment_amount': str(payment_data.get('payment_amount')),
                'reference': payment_data.get('reference', ''),
                'cust_name': payment_data.get('cust_name', 'Customer'),
                'cust_phone': payment_data.get('cust_phone', '01700000000'),
                'cust_email': payment_data.get('cust_email', 'customer@example.com'),
                'cust_address': payment_data.get('cust_address', 'Dhaka'),
                'callback_url': payment_data.get('callback_url'),
                'checkout_items': payment_data.get('checkout_items', 'Service Fee Payment'),
                'merchantId': self.merchant_id,
                'password': self.password,
            }
            
            # Make request to PayStation
            logger.info(f"Initiating PayStation payment for invoice: {form_data['invoice_number']}")
            logger.info(f"Form Data: {form_data}")  # Log full form data for debugging
            logger.info(f"PayStation Merchant ID: {self.merchant_id}, Sandbox: {self.is_sandbox}")
            
            response = self.session.post(
                self.initiate_api,
                data=form_data,  # PayStation uses form-data
                timeout=15
            )
            
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"PayStation response status: {result.get('status')}")
            
            # Log detailed error if authentication fails
            if result.get('status') == 'failed' or result.get('status') == 'error':
                error_msg = result.get('message', '')
                if 'password' in error_msg.lower() or 'authentication' in error_msg.lower():
                    logger.error(f"PayStation Authentication Error: {error_msg}")
                    logger.error(f"Please verify credentials: Merchant ID={self.merchant_id}, Sandbox={self.is_sandbox}")
                    logger.error(f"Contact PayStation support to verify credentials and unlock account if needed")
            
            # PayStation returns different response structure
            # Check for success indicators
            if result.get('status') == 'success' or result.get('success') or result.get('payment_url'):
                return {
                    'success': True,
                    'payment_url': result.get('payment_url') or result.get('url'),
                    'invoice_number': form_data['invoice_number'],
                    'message': result.get('message', 'Payment session created successfully'),
                    'data': result
                }
            else:
                logger.error(f"PayStation payment initialization failed: {result.get('message', 'Unknown error')}")
                return {
                    'success': False,
                    'message': result.get('message', 'Payment initialization failed'),
                    'error': result
                }
                
        except requests.exceptions.RequestException as e:
            logger.error(f"PayStation API request error: {str(e)}")
            return {
                'success': False,
                'message': f'Payment gateway connection error: {str(e)}',
                'error': str(e)
            }
        except Exception as e:
            logger.error(f"PayStation payment initialization error: {str(e)}")
            return {
                'success': False,
                'message': f'Payment initialization error: {str(e)}',
                'error': str(e)
            }
    
    def check_transaction_status(self, invoice_number):
        """
        Check transaction status with PayStation
        
        Args:
            invoice_number (str): Invoice number to check
        
        Returns:
            dict: Transaction status response
        """
        try:
            # Prepare status check request
            headers = {
                'merchantId': self.merchant_id,
                'Content-Type': 'application/json'
            }
            
            payload = {
                'invoice_number': invoice_number
            }
            
            logger.info(f"Checking PayStation transaction status: {invoice_number}")
            
            response = self.session.post(
                self.status_api,
                json=payload,
                headers=headers,
                timeout=10
            )
            
            response.raise_for_status()
            result = response.json()
            
            # PayStation API returns: { status_code, status, message, data: { ... } }
            # Transaction details (payment_method, trx_id, trx_status, etc.) are inside "data"
            data = result.get('data') or {}
            api_status = (result.get('status') or '').lower()
            trx_status_raw = (data.get('trx_status') or '').strip()
            trx_status_lower = trx_status_raw.lower()
            
            logger.info(f"Transaction status response: status={api_status}, trx_status={trx_status_raw}, data_keys={list(data.keys())}")
            
            # Success = API returned success AND transaction is Success/Successful
            success = api_status == 'success' and trx_status_lower in ('success', 'successful')
            
            # Parse PayStation response - map from nested "data" object
            return {
                'success': success,
                'status': trx_status_raw or result.get('status'),
                'invoice_number': data.get('invoice_number') or invoice_number,
                'amount': data.get('payment_amount'),
                'transaction_id': data.get('trx_id') or result.get('transaction_id') or result.get('trxId'),
                'payment_method': data.get('payment_method'),  # e.g. "bkash", "nagad", "card"
                'paid_at': data.get('order_date_time') or result.get('paid_at') or result.get('payment_date'),
                'data': result
            }
                
        except requests.exceptions.RequestException as e:
            logger.error(f"PayStation status check request error: {str(e)}")
            return {
                'success': False,
                'message': f'Status check connection error: {str(e)}',
                'error': str(e)
            }
        except Exception as e:
            logger.error(f"PayStation status check error: {str(e)}")
            return {
                'success': False,
                'message': f'Status check error: {str(e)}',
                'error': str(e)
            }
    
    def validate_payment(self, invoice_number, amount):
        """
        Validate payment by checking status and comparing amount
        
        Args:
            invoice_number (str): Invoice number
            amount (Decimal): Expected payment amount
        
        Returns:
            dict: Validation response
        """
        try:
            # Check transaction status
            status_result = self.check_transaction_status(invoice_number)
            
            if not status_result.get('success'):
                return {
                    'valid': False,
                    'message': 'Failed to check transaction status'
                }
            
            # Verify payment status
            payment_status = status_result.get('status', '').lower()
            
            if payment_status not in ['paid', 'success', 'successful']:
                return {
                    'valid': False,
                    'message': f'Payment not successful. Status: {payment_status}'
                }
            
            # Verify amount
            paid_amount = Decimal(str(status_result.get('amount', 0)))
            expected_amount = Decimal(str(amount))
            
            if paid_amount != expected_amount:
                logger.warning(f"Amount mismatch: expected {expected_amount}, got {paid_amount}")
                return {
                    'valid': False,
                    'message': f'Amount mismatch: expected {expected_amount}, got {paid_amount}'
                }
            
            return {
                'valid': True,
                'transaction_id': status_result.get('transaction_id'),
                'payment_method': status_result.get('payment_method'),
                'paid_at': status_result.get('paid_at'),
                'message': 'Payment validated successfully'
            }
            
        except Exception as e:
            logger.error(f"PayStation payment validation error: {str(e)}")
            return {
                'valid': False,
                'message': f'Validation error: {str(e)}'
            }


def get_payment_gateway():
    """
    Factory function to get PayStation payment gateway instance
    
    Returns:
        PayStationPaymentGateway: Payment gateway instance
    """
    return PayStationPaymentGateway()


def generate_payment_urls(base_url, invoice_number):
    """
    Generate callback URLs for PayStation
    
    Args:
        base_url (str): Base URL of the application
        invoice_number (str): Invoice number for this payment
    
    Returns:
        dict: Dictionary containing callback URLs
    """
    return {
        'callback_url': f"{base_url}/api/service-fee-management/payments/paystation/success/",
        'success_url': f"{base_url}/api/service-fee-management/payments/paystation/success/",
        'fail_url': f"{base_url}/api/service-fee-management/payments/paystation/fail/",
        'cancel_url': f"{base_url}/api/service-fee-management/payments/paystation/cancel/",
        'ipn_url': f"{base_url}/api/service-fee-management/payments/paystation/ipn/",
    }
