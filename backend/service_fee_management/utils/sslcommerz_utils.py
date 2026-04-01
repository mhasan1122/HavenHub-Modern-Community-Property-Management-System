"""
SSLCommerz Payment Gateway Integration Utility

This module provides functions to integrate with SSLCommerz payment gateway
for processing service fee payments with support for bKash, Nagad, Rocket,
and other payment methods.
"""

import requests
import hashlib
from django.conf import settings
from decimal import Decimal
import logging
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)


class SSLCommerzPaymentGateway:
    """
    SSLCommerz Payment Gateway Integration Class
    """
    
    def __init__(self):
        self.store_id = settings.SSLCOMMERZ_STORE_ID
        self.store_password = settings.SSLCOMMERZ_STORE_PASSWORD
        self.is_sandbox = settings.SSLCOMMERZ_IS_SANDBOX
        self.session_api = settings.SSLCOMMERZ_SESSION_API
        self.validation_api = settings.SSLCOMMERZ_VALIDATION_API
        
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
        Initialize payment with SSLCommerz
        
        Args:
            payment_data (dict): Payment information including:
                - amount: Payment amount
                - transaction_id: Unique transaction ID
                - customer_name: Customer name
                - customer_email: Customer email
                - customer_phone: Customer phone
                - product_name: Product/Service name
                - product_category: Product category
                - success_url: Success callback URL
                - fail_url: Failure callback URL
                - cancel_url: Cancel callback URL
                - ipn_url: IPN (Instant Payment Notification) URL
                - emi_option: Enable EMI (0 or 1)
                - product_profile: Product profile (general, physical-goods, non-physical-goods, airline-tickets, travel-vertical, telecom-vertical)
        
        Returns:
            dict: Response from SSLCommerz including gateway URL and session key
        """
        try:
            # Prepare payment request data
            post_data = {
                'store_id': self.store_id,
                'store_passwd': self.store_password,
                'total_amount': str(payment_data.get('amount')),
                'currency': payment_data.get('currency', 'BDT'),
                'tran_id': payment_data.get('transaction_id'),
                'success_url': payment_data.get('success_url'),
                'fail_url': payment_data.get('fail_url'),
                'cancel_url': payment_data.get('cancel_url'),
                'ipn_url': payment_data.get('ipn_url', ''),
                
                # Customer Information
                'cus_name': payment_data.get('customer_name', 'Customer'),
                'cus_email': payment_data.get('customer_email', 'customer@example.com'),
                'cus_add1': payment_data.get('customer_address', 'Dhaka'),
                'cus_city': payment_data.get('customer_city', 'Dhaka'),
                'cus_postcode': payment_data.get('customer_postcode', '1000'),
                'cus_country': payment_data.get('customer_country', 'Bangladesh'),
                'cus_phone': payment_data.get('customer_phone', '01700000000'),
                
                # Shipment Information (required fields)
                'shipping_method': 'NO',
                'num_of_item': 1,
                'ship_name': payment_data.get('customer_name', 'Customer'),
                'ship_add1': payment_data.get('customer_address', 'Dhaka'),
                'ship_city': payment_data.get('customer_city', 'Dhaka'),
                'ship_postcode': payment_data.get('customer_postcode', '1000'),
                'ship_country': payment_data.get('customer_country', 'Bangladesh'),
                
                # Product Information
                'product_name': payment_data.get('product_name', 'Service Fee Payment'),
                'product_category': payment_data.get('product_category', 'Service'),
                'product_profile': payment_data.get('product_profile', 'general'),
                
                # Additional Parameters
                'emi_option': payment_data.get('emi_option', 0),
                'value_a': payment_data.get('value_a', ''),  # Custom field 1
                'value_b': payment_data.get('value_b', ''),  # Custom field 2
                'value_c': payment_data.get('value_c', ''),  # Custom field 3
                'value_d': payment_data.get('value_d', ''),  # Custom field 4
            }
            
            # Make request to SSLCommerz
            logger.info(f"Initiating SSLCommerz payment for transaction: {post_data['tran_id']}")
            
            response = self.session.post(
                self.session_api,
                data=post_data,
                timeout=15  # Reduced timeout for faster response
            )
            
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"SSLCommerz response status: {result.get('status')}")
            
            if result.get('status') == 'SUCCESS':
                return {
                    'success': True,
                    'gateway_url': result.get('GatewayPageURL'),
                    'session_key': result.get('sessionkey'),
                    'transaction_id': post_data['tran_id'],
                    'message': 'Payment session created successfully'
                }
            else:
                logger.error(f"SSLCommerz payment initialization failed: {result.get('failedreason')}")
                return {
                    'success': False,
                    'message': result.get('failedreason', 'Payment initialization failed'),
                    'error': result
                }
                
        except requests.exceptions.RequestException as e:
            logger.error(f"SSLCommerz API request error: {str(e)}")
            return {
                'success': False,
                'message': f'Payment gateway connection error: {str(e)}',
                'error': str(e)
            }
        except Exception as e:
            logger.error(f"SSLCommerz payment initialization error: {str(e)}")
            return {
                'success': False,
                'message': f'Payment initialization error: {str(e)}',
                'error': str(e)
            }
    
    def validate_payment(self, val_id, transaction_id, amount):
        """
        Validate payment with SSLCommerz
        
        Args:
            val_id (str): Validation ID from SSLCommerz
            transaction_id (str): Transaction ID
            amount (Decimal): Payment amount
        
        Returns:
            dict: Validation response
        """
        try:
            # Prepare validation request
            validation_params = {
                'val_id': val_id,
                'store_id': self.store_id,
                'store_passwd': self.store_password,
                'format': 'json'
            }
            
            logger.info(f"Validating payment: {transaction_id}")
            
            response = self.session.get(
                self.validation_api,
                params=validation_params,
                timeout=8  # Further reduced timeout for faster response
            )
            
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"Validation response status: {result.get('status')}")
            
            # Check validation status
            if result.get('status') == 'VALID' or result.get('status') == 'VALIDATED':
                # Verify transaction details
                if result.get('tran_id') == transaction_id:
                    # Verify amount (allow small difference for floating point)
                    result_amount = Decimal(str(result.get('amount', 0)))
                    expected_amount = Decimal(str(amount))
                    
                    if abs(result_amount - expected_amount) < Decimal('0.01'):
                        return {
                            'success': True,
                            'status': result.get('status'),
                            'transaction_id': result.get('tran_id'),
                            'amount': result.get('amount'),
                            'currency': result.get('currency'),
                            'card_type': result.get('card_type'),
                            'card_no': result.get('card_no'),
                            'bank_tran_id': result.get('bank_tran_id'),
                            'card_issuer': result.get('card_issuer'),
                            'card_brand': result.get('card_brand'),
                            'card_issuer_country': result.get('card_issuer_country'),
                            'risk_level': result.get('risk_level'),
                            'risk_title': result.get('risk_title'),
                            'message': 'Payment validated successfully'
                        }
                    else:
                        logger.error(f"Amount mismatch: expected {expected_amount}, got {result_amount}")
                        return {
                            'success': False,
                            'message': 'Payment amount mismatch',
                            'error': 'Amount validation failed'
                        }
                else:
                    logger.error(f"Transaction ID mismatch: expected {transaction_id}, got {result.get('tran_id')}")
                    return {
                        'success': False,
                        'message': 'Transaction ID mismatch',
                        'error': 'Transaction verification failed'
                    }
            elif result.get('status') == 'FAILED':
                logger.warning(f"Payment validation failed: {result.get('error')}")
                return {
                    'success': False,
                    'status': result.get('status'),
                    'message': 'Payment validation failed',
                    'error': result.get('error', 'Validation failed')
                }
            else:
                logger.error(f"Invalid validation status: {result.get('status')}")
                return {
                    'success': False,
                    'message': f"Invalid validation status: {result.get('status')}",
                    'error': result
                }
                
        except requests.exceptions.RequestException as e:
            logger.error(f"SSLCommerz validation API request error: {str(e)}")
            return {
                'success': False,
                'message': f'Payment validation connection error: {str(e)}',
                'error': str(e)
            }
        except Exception as e:
            logger.error(f"SSLCommerz payment validation error: {str(e)}")
            return {
                'success': False,
                'message': f'Payment validation error: {str(e)}',
                'error': str(e)
            }
    
    def verify_hash(self, post_data):
        """
        Verify hash value from SSLCommerz IPN/callback
        
        Args:
            post_data (dict): POST data from SSLCommerz callback
        
        Returns:
            bool: True if hash is valid, False otherwise
        """
        try:
            verify_sign = post_data.get('verify_sign', '')
            verify_key = post_data.get('verify_key', '')
            
            if not verify_sign or not verify_key:
                logger.warning("Missing verify_sign or verify_key in callback")
                return False
            
            # Create hash
            hash_string = f"{self.store_password}{verify_key}"
            generated_hash = hashlib.md5(hash_string.encode()).hexdigest()
            
            is_valid = generated_hash == verify_sign
            
            if not is_valid:
                logger.warning(f"Hash verification failed: expected {generated_hash}, got {verify_sign}")
            
            return is_valid
            
        except Exception as e:
            logger.error(f"Hash verification error: {str(e)}")
            return False


# Helper functions
def get_payment_gateway():
    """
    Get SSLCommerz payment gateway instance
    
    Returns:
        SSLCommerzPaymentGateway: Payment gateway instance
    """
    return SSLCommerzPaymentGateway()


def generate_payment_urls(request, transaction_id):
    """
    Generate callback URLs for SSLCommerz payment
    
    Args:
        request: Django request object
        transaction_id (str): Transaction ID
    
    Returns:
        dict: Dictionary containing success, fail, cancel, and IPN URLs
    """
    # Build base URL from request
    protocol = 'https' if request.is_secure() else 'http'
    host = request.get_host()
    base_url = f"{protocol}://{host}"
    
    return {
        'success_url': f"{base_url}/api/service-fee-management/payments/sslcommerz/success/",
        'fail_url': f"{base_url}/api/service-fee-management/payments/sslcommerz/fail/",
        'cancel_url': f"{base_url}/api/service-fee-management/payments/sslcommerz/cancel/",
        'ipn_url': f"{base_url}/api/service-fee-management/payments/sslcommerz/ipn/",
    }

