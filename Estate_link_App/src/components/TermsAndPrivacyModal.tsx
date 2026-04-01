import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface TermsAndPrivacyModalProps {
  visible: boolean;
  onClose: () => void;
}

export function TermsAndPrivacyModal({ visible, onClose }: TermsAndPrivacyModalProps) {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>('terms');

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View className="mb-6">
      <Text className="font-oxanium-bold text-lg text-gray-900 mb-3">{title}</Text>
      {children}
    </View>
  );

  const Paragraph = ({ children }: { children: React.ReactNode }) => (
    <Text className="font-lato text-sm text-gray-700 leading-6 mb-3">{children}</Text>
  );

  const SubSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View className="mb-4">
      <Text className="font-lato-bold text-base text-gray-800 mb-2">{title}</Text>
      {children}
    </View>
  );

  const BulletPoint = ({ children }: { children: React.ReactNode }) => (
    <View className="flex-row items-start mb-2 ml-3">
      <Text className="font-lato text-sm text-gray-700 mr-2">•</Text>
      <Text className="font-lato text-sm text-gray-700 flex-1 leading-6">{children}</Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl h-5/6">
          {/* Header */}
          <View className="border-b border-gray-200 pb-3">
            <View className="flex-row items-center justify-between px-6 pt-4">
              <Text className="font-oxanium-bold text-xl text-gray-900">
                Legal Documents
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="p-2"
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color="#000000" />
            </TouchableOpacity>
          </View>

            {/* Tabs */}
            <View className="flex-row px-6 pt-3">
              <TouchableOpacity
                onPress={() => setActiveTab('terms')}
                className={`flex-1 py-3 border-b-2 ${
                  activeTab === 'terms' ? 'border-primary' : 'border-transparent'
                }`}
                activeOpacity={0.7}
              >
                <Text
                  className={`font-lato-bold text-center ${
                    activeTab === 'terms' ? 'text-primary' : 'text-gray-500'
                  }`}
                >
                  Terms & Conditions
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => setActiveTab('privacy')}
                className={`flex-1 py-3 border-b-2 ${
                  activeTab === 'privacy' ? 'border-primary' : 'border-transparent'
                }`}
                activeOpacity={0.7}
              >
                <Text
                  className={`font-lato-bold text-center ${
                    activeTab === 'privacy' ? 'text-primary' : 'text-gray-500'
                  }`}
                >
                  Privacy Policy
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            className="flex-1 px-6 py-4"
            showsVerticalScrollIndicator={true}
          >
            {activeTab === 'terms' ? (
              <View>
                {/* Header Information */}
                <View className="mb-6 pb-4 border-b border-gray-200">
                  <Text className="font-oxanium-bold text-2xl text-gray-900 mb-2">
                    Terms & Conditions
                  </Text>
                  <Text className="font-lato text-sm text-gray-600">
                    Last Updated: January 5, 2026
                  </Text>
                  <Text className="font-lato text-sm text-gray-600">
                    Version: 1.0
                  </Text>
                </View>

                <Section title="1. Definitions">
                  <Paragraph>
                    For the purposes of these Terms & Conditions, the following definitions apply:
                  </Paragraph>
                  
                  <BulletPoint>
                    <Text className="font-lato-bold">Estate Link:</Text> The property management SaaS platform, including Estate Control and Estate Community applications, operated by Estate Link.
                  </BulletPoint>
                  
                  <BulletPoint>
                    <Text className="font-lato-bold">Estate Control:</Text> The web-based and mobile administrative application designed for property management companies, building administrators, and authorized personnel.
                  </BulletPoint>
                  
                  <BulletPoint>
                    <Text className="font-lato-bold">Estate Community:</Text> The mobile application designed for residents and community members to access services, announcements, payments, and community features.
                  </BulletPoint>
                  
                  <BulletPoint>
                    <Text className="font-lato-bold">Organization:</Text> The property management company, residential association, or entity that subscribes to Estate Link services and manages one or more properties.
                  </BulletPoint>
                  
                  <BulletPoint>
                    <Text className="font-lato-bold">Administrator:</Text> Authorized personnel within an Organization who use Estate Control to manage properties, residents, and services.
                  </BulletPoint>
                  
                  <BulletPoint>
                    <Text className="font-lato-bold">Resident:</Text> Individual users who access Estate Community to interact with their residential community and property management.
                  </BulletPoint>
                  
                  <BulletPoint>
                    <Text className="font-lato-bold">User:</Text> Any person accessing or using Estate Link services, including Administrators and Residents.
                  </BulletPoint>
                  
                  <BulletPoint>
                    <Text className="font-lato-bold">Services:</Text> All features, functions, and capabilities provided through the Estate Link platform.
                  </BulletPoint>
                </Section>

                <Section title="2. Acceptance of Terms">
                  <Paragraph>
                    By accessing or using Estate Link, Estate Control, or Estate Community, you acknowledge that you have read, understood, and agree to be bound by these Terms & Conditions and our Privacy Policy. If you do not agree to these terms, you must not access or use our Services.
                  </Paragraph>
                  
                  <Paragraph>
                    These Terms constitute a legally binding agreement between you and Estate Link. Your continued use of the Services constitutes ongoing acceptance of these Terms.
                  </Paragraph>
                </Section>

                <Section title="3. Scope of Services">
                  <SubSection title="3.1 Estate Control">
                    <Paragraph>
                      Estate Control provides Organizations and Administrators with tools to:
                    </Paragraph>
                    <BulletPoint>Manage property information, buildings, towers, and units</BulletPoint>
                    <BulletPoint>Create and manage resident accounts and access</BulletPoint>
                    <BulletPoint>Generate and manage service charges and billing</BulletPoint>
                    <BulletPoint>Publish announcements and bulletin notices</BulletPoint>
                    <BulletPoint>Monitor payments and financial reports</BulletPoint>
                    <BulletPoint>Manage services, vendors, and maintenance requests</BulletPoint>
                    <BulletPoint>Control user permissions and administrative access</BulletPoint>
                  </SubSection>
                  
                  <SubSection title="3.2 Estate Community">
                    <Paragraph>
                      Estate Community provides Residents with access to:
                    </Paragraph>
                    <BulletPoint>View property and community information</BulletPoint>
                    <BulletPoint>Receive announcements and notifications from management</BulletPoint>
                    <BulletPoint>View and pay service charges and utility bills</BulletPoint>
                    <BulletPoint>Access payment history and receipts</BulletPoint>
                    <BulletPoint>Submit service requests and maintenance issues</BulletPoint>
                    <BulletPoint>Access community resources and contact information</BulletPoint>
                    <BulletPoint>View bulletin board notices and community updates</BulletPoint>
                  </SubSection>
                  
                  <SubSection title="3.3 Service Nature">
                    <Paragraph>
                      Estate Link is a software-as-a-service (SaaS) platform. We provide software tools and infrastructure. Estate Link does not:
                    </Paragraph>
                    <BulletPoint>Own, manage, or operate properties</BulletPoint>
                    <BulletPoint>Provide property management services directly</BulletPoint>
                    <BulletPoint>Act as a payment processor or financial institution</BulletPoint>
                    <BulletPoint>Determine pricing, fees, or charges for properties</BulletPoint>
                    <BulletPoint>Control or manage relationships between Organizations and Residents</BulletPoint>
                  </SubSection>
                </Section>

                <Section title="4. Account Access & Responsibilities">
                  <SubSection title="4.1 Account Creation">
                    <Paragraph>
                      Resident accounts are created and provisioned by Organizations through Estate Control. By accepting an account invitation, you confirm that:
                    </Paragraph>
                    <BulletPoint>You are at least 18 years of age</BulletPoint>
                    <BulletPoint>You are authorized to represent the residential unit assigned to your account</BulletPoint>
                    <BulletPoint>All information you provide is accurate and current</BulletPoint>
                  </SubSection>
                  
                  <SubSection title="4.2 Account Security">
                    <Paragraph>
                      You are responsible for:
                    </Paragraph>
                    <BulletPoint>Maintaining the confidentiality of your login credentials</BulletPoint>
                    <BulletPoint>All activities that occur under your account</BulletPoint>
                    <BulletPoint>Notifying Estate Link immediately of unauthorized access</BulletPoint>
                    <BulletPoint>Ensuring your account information remains accurate</BulletPoint>
                  </SubSection>
                  
                  <SubSection title="4.3 Account Termination">
                    <Paragraph>
                      Organizations control user accounts. Your access may be suspended or terminated by your Organization at any time. Estate Link may also suspend or terminate accounts that violate these Terms.
                    </Paragraph>
                  </SubSection>
                </Section>

                <Section title="5. Subscription & Commercial Model">
                  <SubSection title="5.1 B2B SaaS Structure">
                    <Paragraph>
                      Estate Link operates as a business-to-business (B2B) SaaS platform. Organizations subscribe to Estate Link services through:
                    </Paragraph>
                    <BulletPoint>Direct contractual agreements with Estate Link</BulletPoint>
                    <BulletPoint>Web-based subscription portals</BulletPoint>
                    <BulletPoint>Sales and business development channels</BulletPoint>
                  </SubSection>
                  
                  <SubSection title="5.2 No In-App Subscriptions">
                    <Paragraph>
                      Neither Estate Control nor Estate Community offer in-app purchases of digital goods or subscriptions. The mobile applications are access portals for Organizations and Residents already authorized through existing subscription agreements.
                    </Paragraph>
                  </SubSection>
                  
                  <SubSection title="5.3 Resident Access">
                    <Paragraph>
                      Residents do not pay Estate Link directly for app access or subscriptions. Resident access is provided by their Organization as part of the Organization's subscription to Estate Link services.
                    </Paragraph>
                  </SubSection>
                </Section>

                <Section title="6. Payments & Billing">
                  <SubSection title="6.1 Real-World Services Only">
                    <Paragraph>
                      <Text className="font-lato-bold">IMPORTANT - Google Play Policy Compliance:</Text> All payments processed through Estate Community are for real-world services only, including:
                    </Paragraph>
                    <BulletPoint>Monthly service charges and maintenance fees</BulletPoint>
                    <BulletPoint>Utility bills (electricity, water, gas, etc.)</BulletPoint>
                    <BulletPoint>Property-related services and amenities</BulletPoint>
                    <BulletPoint>Physical maintenance and repair services</BulletPoint>
                    <BulletPoint>Real-world property-related charges</BulletPoint>
                    
                    <Paragraph>
                      These payments are NOT for digital goods, in-app content, subscriptions, or app features. They are exclusively for physical services and obligations related to property management and residency.
                    </Paragraph>
                  </SubSection>
                  
                  <SubSection title="6.2 Third-Party Payment Processing">
                    <Paragraph>
                      All payments are processed by third-party payment gateway providers. Estate Link:
                    </Paragraph>
                    <BulletPoint>Does not store or process payment card information</BulletPoint>
                    <BulletPoint>Does not act as a payment processor or financial institution</BulletPoint>
                    <BulletPoint>Facilitates payment transactions between Residents and Organizations</BulletPoint>
                    <BulletPoint>Integrates with licensed payment gateway providers for secure processing</BulletPoint>
                  </SubSection>
                  
                  <SubSection title="6.3 Payment Terms">
                    <Paragraph>
                      When making payments through Estate Community:
                    </Paragraph>
                    <BulletPoint>You authorize payment to your Organization, not Estate Link</BulletPoint>
                    <BulletPoint>Payment terms, amounts, and schedules are set by your Organization</BulletPoint>
                    <BulletPoint>You agree to the payment gateway provider's terms and conditions</BulletPoint>
                    <BulletPoint>Payment disputes must be addressed with your Organization</BulletPoint>
                    <BulletPoint>Estate Link is not responsible for payment failures, errors, or disputes</BulletPoint>
                  </SubSection>
                  
                  <SubSection title="6.4 Refunds & Disputes">
                    <Paragraph>
                      Refund policies are determined by your Organization. Estate Link does not control or process refunds. All billing disputes must be resolved between you and your Organization.
                    </Paragraph>
                  </SubSection>
                </Section>

                <Section title="7. Content & Communications">
                  <SubSection title="7.1 Organization Content">
                    <Paragraph>
                      Organizations are responsible for all content they publish through Estate Control, including announcements, bulletin notices, service information, and communications to Residents.
                    </Paragraph>
                  </SubSection>
                  
                  <SubSection title="7.2 Content Moderation">
                    <Paragraph>
                      Organizations are responsible for moderating and managing content. Estate Link reserves the right to remove content that violates these Terms, applicable laws, or platform policies, but has no obligation to monitor or moderate content.
                    </Paragraph>
                  </SubSection>
                  
                  <SubSection title="7.3 Intellectual Property">
                    <Paragraph>
                      Organizations retain ownership of content they create. By using Estate Link, Organizations grant Estate Link a limited license to host, store, and display content as necessary to provide Services.
                    </Paragraph>
                  </SubSection>
                </Section>

                <Section title="8. User Conduct">
                  <Paragraph>
                    Users must not:
                  </Paragraph>
                  <BulletPoint>Violate any applicable laws or regulations</BulletPoint>
                  <BulletPoint>Infringe on intellectual property rights</BulletPoint>
                  <BulletPoint>Transmit harmful, threatening, or harassing content</BulletPoint>
                  <BulletPoint>Attempt to gain unauthorized access to systems or data</BulletPoint>
                  <BulletPoint>Interfere with the operation of Estate Link services</BulletPoint>
                  <BulletPoint>Use automated systems or bots to access Services</BulletPoint>
                  <BulletPoint>Reverse engineer or attempt to extract source code</BulletPoint>
                  <BulletPoint>Use Services for any fraudulent or illegal purpose</BulletPoint>
                </Section>

                <Section title="9. Data Protection & Privacy">
                  <Paragraph>
                    Our Privacy Policy (see Privacy Policy tab) describes how we collect, use, and protect personal information. Key principles:
                  </Paragraph>
                  <BulletPoint>Organizations own and control resident data</BulletPoint>
                  <BulletPoint>Estate Link acts as a data processor for Organizations</BulletPoint>
                  <BulletPoint>Payment data is processed by third-party payment gateways</BulletPoint>
                  <BulletPoint>Users have rights regarding their personal information</BulletPoint>
                  
                  <Paragraph>
                    By using Estate Link, you consent to data collection and processing as described in our Privacy Policy.
                  </Paragraph>
                </Section>

                <Section title="10. Third-Party Services">
                  <Paragraph>
                    Estate Link integrates with third-party services including payment gateways, communication providers, and infrastructure services. These third parties have their own terms and privacy policies. Estate Link is not responsible for third-party services, their availability, security, or practices.
                  </Paragraph>
                </Section>

                <Section title="11. Service Availability & Changes">
                  <SubSection title="11.1 Availability">
                    <Paragraph>
                      We strive to provide reliable service availability but do not guarantee uninterrupted access. Services may be temporarily unavailable due to maintenance, updates, or technical issues.
                    </Paragraph>
                  </SubSection>
                  
                  <SubSection title="11.2 Service Changes">
                    <Paragraph>
                      Estate Link reserves the right to:
                    </Paragraph>
                    <BulletPoint>Modify, update, or discontinue features</BulletPoint>
                    <BulletPoint>Change pricing for Organizations (subject to contractual agreements)</BulletPoint>
                    <BulletPoint>Update technical requirements and compatibility</BulletPoint>
                    <BulletPoint>Improve or enhance Services</BulletPoint>
                  </SubSection>
                </Section>

                <Section title="12. Limitation of Liability">
                  <Paragraph>
                    TO THE MAXIMUM EXTENT PERMITTED BY LAW:
                  </Paragraph>
                  
                  <BulletPoint>Estate Link provides Services "AS IS" and "AS AVAILABLE" without warranties of any kind</BulletPoint>
                  <BulletPoint>Estate Link disclaims all warranties, express or implied, including merchantability and fitness for a particular purpose</BulletPoint>
                  <BulletPoint>Estate Link is not liable for indirect, incidental, consequential, or special damages</BulletPoint>
                  <BulletPoint>Estate Link's total liability shall not exceed the fees paid by the Organization in the 12 months preceding the claim</BulletPoint>
                  <BulletPoint>Estate Link is not responsible for Organization actions, decisions, or content</BulletPoint>
                  <BulletPoint>Estate Link is not responsible for payment disputes, billing errors, or refund issues</BulletPoint>
                  <BulletPoint>Estate Link is not liable for third-party service failures or security breaches</BulletPoint>
                </Section>

                <Section title="13. Indemnification">
                  <Paragraph>
                    You agree to indemnify, defend, and hold harmless Estate Link, its officers, directors, employees, and agents from any claims, liabilities, damages, losses, costs, or expenses (including legal fees) arising from:
                  </Paragraph>
                  <BulletPoint>Your use of Estate Link Services</BulletPoint>
                  <BulletPoint>Your violation of these Terms</BulletPoint>
                  <BulletPoint>Your violation of any rights of third parties</BulletPoint>
                  <BulletPoint>Content you submit or publish</BulletPoint>
                  <BulletPoint>Your breach of applicable laws or regulations</BulletPoint>
                </Section>

                <Section title="14. Termination">
                  <SubSection title="14.1 By Organizations">
                    <Paragraph>
                      Organizations may terminate their subscription according to contractual agreements with Estate Link.
                    </Paragraph>
                  </SubSection>
                  
                  <SubSection title="14.2 By Estate Link">
                    <Paragraph>
                      Estate Link may suspend or terminate access immediately without notice if:
                    </Paragraph>
                    <BulletPoint>Terms are violated</BulletPoint>
                    <BulletPoint>Account is used fraudulently or illegally</BulletPoint>
                    <BulletPoint>Required by law or regulatory authorities</BulletPoint>
                    <BulletPoint>Organization's subscription ends or is terminated</BulletPoint>
                  </SubSection>
                  
                  <SubSection title="14.3 Effect of Termination">
                    <Paragraph>
                      Upon termination, access to Services ceases immediately. Data retention and deletion are governed by our Privacy Policy and applicable data protection laws.
                    </Paragraph>
                  </SubSection>
                </Section>

                <Section title="15. Governing Law & Dispute Resolution">
                  <Paragraph>
                    These Terms are governed by the laws of Bangladesh. Any disputes arising from these Terms or use of Estate Link Services shall be subject to the exclusive jurisdiction of the courts of Bangladesh.
                  </Paragraph>
                  
                  <Paragraph>
                    Before pursuing legal action, parties agree to attempt good-faith negotiation to resolve disputes.
                  </Paragraph>
                </Section>

                <Section title="16. Updates to Terms">
                  <Paragraph>
                    Estate Link may update these Terms periodically. Material changes will be communicated through:
                  </Paragraph>
                  <BulletPoint>In-app notifications</BulletPoint>
                  <BulletPoint>Email notifications to registered addresses</BulletPoint>
                  <BulletPoint>Updates posted on our website</BulletPoint>
                  
                  <Paragraph>
                    Continued use after changes constitutes acceptance of updated Terms. Users who do not accept updated Terms must discontinue use of Services.
                  </Paragraph>
                </Section>

                <Section title="17. Severability">
                  <Paragraph>
                    If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions remain in full force and effect. Invalid provisions will be modified to the minimum extent necessary to make them valid and enforceable.
                  </Paragraph>
                </Section>

                <Section title="18. Entire Agreement">
                  <Paragraph>
                    These Terms, together with the Privacy Policy and any Organization-specific agreements, constitute the entire agreement between users and Estate Link regarding Services.
                  </Paragraph>
                </Section>

                <Section title="19. Contact Information">
                  <Paragraph>
                    For questions, concerns, or support regarding these Terms or Estate Link Services:
                  </Paragraph>
                  
                  <View className="mt-3 mb-2">
                    <Text className="font-lato-bold text-sm text-gray-800">Estate Link</Text>
                    <Text className="font-lato text-sm text-gray-700 leading-6 mt-1">
                      Email: support@estatelink.com
                    </Text>
                    <Text className="font-lato text-sm text-gray-700 leading-6">
                      Website: www.estatelink.com
                    </Text>
                  </View>
                </Section>

                <View className="mt-8 mb-6 p-4 bg-gray-100 rounded-lg">
                  <Text className="font-lato-bold text-sm text-gray-800 mb-2">
                    Acknowledgment
                  </Text>
                  <Text className="font-lato text-xs text-gray-700 leading-5">
                    BY USING ESTATE LINK, ESTATE CONTROL, OR ESTATE COMMUNITY, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS & CONDITIONS.
                  </Text>
                </View>
              </View>
            ) : (
              <View>
                {/* Privacy Policy Content */}
                <View className="mb-6 pb-4 border-b border-gray-200">
                  <Text className="font-oxanium-bold text-2xl text-gray-900 mb-2">
                    Privacy Policy
                  </Text>
                  <Text className="font-lato text-sm text-gray-600">
                    Last Updated: January 5, 2026
                  </Text>
                  <Text className="font-lato text-sm text-gray-600">
                    Version: 1.0
                  </Text>
                </View>

                <Section title="1. Introduction">
                  <Paragraph>
                    Estate Link ("we," "us," or "our") is committed to protecting the privacy and security of personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard information when you use Estate Control and Estate Community (collectively, "Services").
                  </Paragraph>
                  
                  <Paragraph>
                    By using our Services, you consent to the data practices described in this Privacy Policy. If you do not agree with this Privacy Policy, please do not access or use our Services.
                  </Paragraph>
                </Section>

                <Section title="2. Information We Collect">
                  <SubSection title="2.1 Information Provided by Organizations">
                    <Paragraph>
                      Organizations provide information when creating and managing resident accounts:
                    </Paragraph>
                    <BulletPoint>Personal identification (name, email, phone number)</BulletPoint>
                    <BulletPoint>Residential information (property, building, tower, unit)</BulletPoint>
                    <BulletPoint>Account credentials and access permissions</BulletPoint>
                    <BulletPoint>Billing and service charge information</BulletPoint>
                  </SubSection>
                  
                  <SubSection title="2.2 Information You Provide">
                    <Paragraph>
                      When using Services, you may provide:
                    </Paragraph>
                    <BulletPoint>Profile updates and account modifications</BulletPoint>
                    <BulletPoint>Service requests and maintenance reports</BulletPoint>
                    <BulletPoint>Communications with property management</BulletPoint>
                    <BulletPoint>Feedback and support inquiries</BulletPoint>
                  </SubSection>
                  
                  <SubSection title="2.3 Payment Information">
                    <Paragraph>
                      Payment information is collected and processed by third-party payment gateway providers, not Estate Link. We receive only transaction confirmation data:
                    </Paragraph>
                    <BulletPoint>Transaction IDs and payment confirmations</BulletPoint>
                    <BulletPoint>Payment amounts and dates</BulletPoint>
                    <BulletPoint>Payment status (successful, pending, failed)</BulletPoint>
                    
                    <Paragraph>
                      We do NOT collect, store, or process:
                    </Paragraph>
                    <BulletPoint>Credit card numbers</BulletPoint>
                    <BulletPoint>Bank account information</BulletPoint>
                    <BulletPoint>Payment card security codes</BulletPoint>
                    <BulletPoint>Financial credentials</BulletPoint>
                  </SubSection>
                  
                  <SubSection title="2.4 Automatically Collected Information">
                    <Paragraph>
                      When you use our Services, we automatically collect:
                    </Paragraph>
                    <BulletPoint>Device information (device type, operating system, unique device identifiers)</BulletPoint>
                    <BulletPoint>Usage data (features accessed, time spent, interaction patterns)</BulletPoint>
                    <BulletPoint>Log data (IP address, access times, app crashes, performance data)</BulletPoint>
                    <BulletPoint>Mobile app analytics (screen views, button clicks, navigation paths)</BulletPoint>
                  </SubSection>
                  
                  <SubSection title="2.5 Permissions">
                    <Paragraph>
                      Estate Community may request device permissions:
                    </Paragraph>
                    <BulletPoint>Notifications: To deliver important announcements and payment reminders</BulletPoint>
                    <BulletPoint>Storage: To cache data and save receipts/documents locally</BulletPoint>
                    <BulletPoint>Camera: To upload photos for service requests (optional)</BulletPoint>
                    <BulletPoint>Network: To communicate with Estate Link servers</BulletPoint>
                    
                    <Paragraph>
                      You can manage permissions through your device settings. Denying permissions may limit functionality.
                    </Paragraph>
                  </SubSection>
                </Section>

                <Section title="3. How We Use Information">
                  <Paragraph>
                    We use collected information to:
                  </Paragraph>
                  
                  <SubSection title="3.1 Provide Services">
                    <BulletPoint>Authenticate and manage user accounts</BulletPoint>
                    <BulletPoint>Display property and billing information</BulletPoint>
                    <BulletPoint>Process and record payment transactions</BulletPoint>
                    <BulletPoint>Deliver announcements and notifications</BulletPoint>
                    <BulletPoint>Facilitate communication between Residents and Organizations</BulletPoint>
                  </SubSection>
                  
                  <SubSection title="3.2 Improve Services">
                    <BulletPoint>Analyze usage patterns and user behavior</BulletPoint>
                    <BulletPoint>Identify and fix technical issues</BulletPoint>
                    <BulletPoint>Develop new features and enhancements</BulletPoint>
                    <BulletPoint>Optimize performance and user experience</BulletPoint>
                  </SubSection>
                  
                  <SubSection title="3.3 Security & Compliance">
                    <BulletPoint>Detect and prevent fraud and security threats</BulletPoint>
                    <BulletPoint>Enforce Terms & Conditions</BulletPoint>
                    <BulletPoint>Comply with legal obligations and regulations</BulletPoint>
                    <BulletPoint>Protect rights and safety of users</BulletPoint>
                  </SubSection>
                  
                  <SubSection title="3.4 Communication">
                    <BulletPoint>Send system notifications and service updates</BulletPoint>
                    <BulletPoint>Respond to support requests and inquiries</BulletPoint>
                    <BulletPoint>Provide customer service and technical support</BulletPoint>
                    <BulletPoint>Notify about Terms or Privacy Policy changes</BulletPoint>
                  </SubSection>
                </Section>

                <Section title="4. Data Ownership & Control">
                  <SubSection title="4.1 Organization Data Ownership">
                    <Paragraph>
                      Organizations own and control all data related to their properties, residents, billing, and operations. Estate Link acts as a data processor on behalf of Organizations.
                    </Paragraph>
                  </SubSection>
                  
                  <SubSection title="4.2 Data Controller Role">
                    <Paragraph>
                      Your Organization (property management company or residential association) is the data controller. They determine:
                    </Paragraph>
                    <BulletPoint>What resident information is collected</BulletPoint>
                    <BulletPoint>How information is used within the organization</BulletPoint>
                    <BulletPoint>Who has access to your information</BulletPoint>
                    <BulletPoint>Data retention policies</BulletPoint>
                  </SubSection>
                  
                  <SubSection title="4.3 Estate Link's Role">
                    <Paragraph>
                      As a data processor, Estate Link:
                    </Paragraph>
                    <BulletPoint>Processes data according to Organization instructions</BulletPoint>
                    <BulletPoint>Implements security measures to protect data</BulletPoint>
                    <BulletPoint>Provides tools for Organizations to manage data</BulletPoint>
                    <BulletPoint>Does not use Organization data for purposes beyond providing Services</BulletPoint>
                  </SubSection>
                </Section>

                <Section title="5. Information Sharing & Disclosure">
                  <Paragraph>
                    We do not sell or rent personal information. We share information only in the following circumstances:
                  </Paragraph>
                  
                  <SubSection title="5.1 With Organizations">
                    <Paragraph>
                      Your Organization has full access to data associated with your account, including personal information, usage data, payment history, and communications.
                    </Paragraph>
                  </SubSection>
                  
                  <SubSection title="5.2 With Service Providers">
                    <Paragraph>
                      We share information with trusted third-party service providers who assist in operating Services:
                    </Paragraph>
                    <BulletPoint>Payment gateway providers (for payment processing)</BulletPoint>
                    <BulletPoint>Cloud hosting infrastructure providers</BulletPoint>
                    <BulletPoint>Analytics and monitoring services</BulletPoint>
                    <BulletPoint>Communication and notification services</BulletPoint>
                    
                    <Paragraph>
                      These providers are contractually obligated to protect information and use it only for specified purposes.
                    </Paragraph>
                  </SubSection>
                  
                  <SubSection title="5.3 For Legal Reasons">
                    <Paragraph>
                      We may disclose information when required by law or when we believe in good faith that disclosure is necessary to:
                    </Paragraph>
                    <BulletPoint>Comply with legal obligations, court orders, or government requests</BulletPoint>
                    <BulletPoint>Enforce our Terms & Conditions</BulletPoint>
                    <BulletPoint>Protect rights, property, or safety of Estate Link, users, or the public</BulletPoint>
                    <BulletPoint>Detect, prevent, or address fraud, security, or technical issues</BulletPoint>
                  </SubSection>
                  
                  <SubSection title="5.4 Business Transfers">
                    <Paragraph>
                      In the event of a merger, acquisition, or sale of assets, user information may be transferred. We will notify users of any such change and choices regarding their information.
                    </Paragraph>
                  </SubSection>
                </Section>

                <Section title="6. Payment Data Handling">
                  <Paragraph>
                    Estate Link complies with payment industry best practices:
                  </Paragraph>
                  
                  <BulletPoint>All payment processing is handled by PCI-DSS compliant third-party payment gateways</BulletPoint>
                  <BulletPoint>Estate Link never stores payment card information on our servers</BulletPoint>
                  <BulletPoint>Payment transactions are encrypted using industry-standard protocols</BulletPoint>
                  <BulletPoint>We receive only transaction confirmations and payment status</BulletPoint>
                  <BulletPoint>Payment disputes must be addressed with the payment gateway or your Organization</BulletPoint>
                  
                  <Paragraph>
                    For specific payment data practices, please review your payment gateway provider's privacy policy.
                  </Paragraph>
                </Section>

                <Section title="7. Data Security">
                  <Paragraph>
                    We implement comprehensive security measures to protect information:
                  </Paragraph>
                  
                  <SubSection title="7.1 Technical Measures">
                    <BulletPoint>Encryption of data in transit (TLS/SSL)</BulletPoint>
                    <BulletPoint>Encryption of sensitive data at rest</BulletPoint>
                    <BulletPoint>Secure authentication and access controls</BulletPoint>
                    <BulletPoint>Regular security audits and vulnerability assessments</BulletPoint>
                    <BulletPoint>Intrusion detection and prevention systems</BulletPoint>
                  </SubSection>
                  
                  <SubSection title="7.2 Organizational Measures">
                    <BulletPoint>Limited access to personal information (need-to-know basis)</BulletPoint>
                    <BulletPoint>Employee training on data protection practices</BulletPoint>
                    <BulletPoint>Confidentiality agreements with employees and contractors</BulletPoint>
                    <BulletPoint>Incident response and data breach protocols</BulletPoint>
                  </SubSection>
                  
                  <Paragraph>
                    While we implement strong security measures, no system is completely secure. Users are responsible for protecting their account credentials and reporting suspicious activity.
                  </Paragraph>
                </Section>

                <Section title="8. Data Retention">
                  <Paragraph>
                    We retain personal information for as long as necessary to:
                  </Paragraph>
                  <BulletPoint>Provide Services to you and your Organization</BulletPoint>
                  <BulletPoint>Comply with legal, regulatory, and contractual obligations</BulletPoint>
                  <BulletPoint>Resolve disputes and enforce agreements</BulletPoint>
                  <BulletPoint>Maintain business records and analytics</BulletPoint>
                  
                  <Paragraph>
                    When an Organization terminates their subscription, we retain data according to contractual agreements and legal requirements. Organizations control deletion requests for their resident data.
                  </Paragraph>
                  
                  <Paragraph>
                    Anonymized or aggregated data (that cannot identify individuals) may be retained indefinitely for analytics and service improvement.
                  </Paragraph>
                </Section>

                <Section title="9. Your Rights & Choices">
                  <SubSection title="9.1 Access & Correction">
                    <Paragraph>
                      You have the right to:
                    </Paragraph>
                    <BulletPoint>Access your personal information through Estate Community</BulletPoint>
                    <BulletPoint>Request corrections to inaccurate information</BulletPoint>
                    <BulletPoint>Update your profile and contact information</BulletPoint>
                    
                    <Paragraph>
                      For data controlled by your Organization, contact your property management directly.
                    </Paragraph>
                  </SubSection>
                  
                  <SubSection title="9.2 Data Deletion">
                    <Paragraph>
                      You may request deletion of your personal information. However:
                    </Paragraph>
                    <BulletPoint>Your Organization controls most of your data and determines retention</BulletPoint>
                    <BulletPoint>We may retain information required for legal or contractual obligations</BulletPoint>
                    <BulletPoint>Deletion requests must be coordinated with your Organization</BulletPoint>
                  </SubSection>
                  
                  <SubSection title="9.3 Marketing Communications">
                    <Paragraph>
                      We do not send marketing communications to Residents. System notifications related to service charges, announcements, and account activities are essential communications that cannot be opted out of while maintaining an active account.
                    </Paragraph>
                  </SubSection>
                  
                  <SubSection title="9.4 Push Notifications">
                    <Paragraph>
                      You can manage push notification preferences through:
                    </Paragraph>
                    <BulletPoint>Estate Community app settings</BulletPoint>
                    <BulletPoint>Your device's system settings</BulletPoint>
                    
                    <Paragraph>
                      Disabling notifications may cause you to miss important announcements and payment reminders.
                    </Paragraph>
                  </SubSection>
                </Section>

                <Section title="10. Children's Privacy">
                  <Paragraph>
                    Estate Link Services are not directed to children under 18. We do not knowingly collect personal information from children under 18.
                  </Paragraph>
                  
                  <Paragraph>
                    If we learn that we have collected information from a child under 18, we will delete that information immediately. If you believe we have collected information from a child, please contact us at privacy@estatelink.com.
                  </Paragraph>
                  
                  <Paragraph>
                    Parents or guardians who wish to access Services on behalf of minors should create and manage accounts using their own information.
                  </Paragraph>
                </Section>

                <Section title="11. International Data Transfers">
                  <Paragraph>
                    Estate Link operates primarily in Bangladesh. If you access Services from outside Bangladesh, your information may be transferred to and processed in Bangladesh or other countries where our service providers operate.
                  </Paragraph>
                  
                  <Paragraph>
                    By using our Services, you consent to the transfer of your information to Bangladesh and other jurisdictions, which may have different data protection laws than your country of residence.
                  </Paragraph>
                </Section>

                <Section title="12. Third-Party Services & Links">
                  <Paragraph>
                    Estate Link Services may contain links to or integrate with third-party services (payment gateways, communication platforms, etc.). We are not responsible for the privacy practices of these third parties.
                  </Paragraph>
                  
                  <Paragraph>
                    We encourage you to review the privacy policies of any third-party services you interact with through Estate Link. This Privacy Policy applies only to Estate Link Services.
                  </Paragraph>
                </Section>

                <Section title="13. California Privacy Rights (CCPA)">
                  <Paragraph>
                    While Estate Link operates primarily in Bangladesh, we respect privacy rights of all users. California residents may have additional rights under the California Consumer Privacy Act (CCPA):
                  </Paragraph>
                  <BulletPoint>Right to know what personal information is collected</BulletPoint>
                  <BulletPoint>Right to know if personal information is sold or shared</BulletPoint>
                  <BulletPoint>Right to access personal information</BulletPoint>
                  <BulletPoint>Right to deletion of personal information</BulletPoint>
                  <BulletPoint>Right to non-discrimination for exercising privacy rights</BulletPoint>
                  
                  <Paragraph>
                    To exercise these rights, contact us at privacy@estatelink.com.
                  </Paragraph>
                </Section>

                <Section title="14. European Privacy Rights (GDPR)">
                  <Paragraph>
                    If you are located in the European Economic Area (EEA), you have certain rights under the General Data Protection Regulation (GDPR):
                  </Paragraph>
                  <BulletPoint>Right to access your personal data</BulletPoint>
                  <BulletPoint>Right to rectification of inaccurate data</BulletPoint>
                  <BulletPoint>Right to erasure ("right to be forgotten")</BulletPoint>
                  <BulletPoint>Right to restriction of processing</BulletPoint>
                  <BulletPoint>Right to data portability</BulletPoint>
                  <BulletPoint>Right to object to processing</BulletPoint>
                  <BulletPoint>Right to withdraw consent</BulletPoint>
                  
                  <Paragraph>
                    To exercise these rights, contact us at privacy@estatelink.com or your Organization's data protection officer.
                  </Paragraph>
                </Section>

                <Section title="15. Changes to Privacy Policy">
                  <Paragraph>
                    We may update this Privacy Policy periodically to reflect changes in our practices, Services, or legal requirements. Material changes will be communicated through:
                  </Paragraph>
                  <BulletPoint>In-app notifications in Estate Community</BulletPoint>
                  <BulletPoint>Email notifications to registered addresses</BulletPoint>
                  <BulletPoint>Notices on our website</BulletPoint>
                  
                  <Paragraph>
                    The "Last Updated" date at the top indicates when changes were made. Continued use of Services after changes constitutes acceptance of the updated Privacy Policy.
                  </Paragraph>
                </Section>

                <Section title="16. Data Breach Notification">
                  <Paragraph>
                    In the unlikely event of a data breach affecting personal information, we will:
                  </Paragraph>
                  <BulletPoint>Notify affected users and Organizations promptly</BulletPoint>
                  <BulletPoint>Notify relevant regulatory authorities as required by law</BulletPoint>
                  <BulletPoint>Provide information about the nature and scope of the breach</BulletPoint>
                  <BulletPoint>Take immediate steps to contain and remediate the breach</BulletPoint>
                  <BulletPoint>Offer guidance on protective measures users should take</BulletPoint>
                </Section>

                <Section title="17. Contact Information">
                  <Paragraph>
                    For questions, concerns, or requests regarding this Privacy Policy or our data practices:
                  </Paragraph>
                  
                  <View className="mt-3 mb-2">
                    <Text className="font-lato-bold text-sm text-gray-800">Estate Link - Privacy Office</Text>
                    <Text className="font-lato text-sm text-gray-700 leading-6 mt-1">
                      Email: privacy@estatelink.com
                    </Text>
                    <Text className="font-lato text-sm text-gray-700 leading-6">
                      Support: support@estatelink.com
                    </Text>
                    <Text className="font-lato text-sm text-gray-700 leading-6">
                      Website: www.estatelink.com
                    </Text>
                  </View>
                  
                  <Paragraph>
                    For data access or deletion requests related to Organization-controlled data, please contact your property management directly.
                  </Paragraph>
                </Section>

                <View className="mt-8 mb-6 p-4 bg-gray-100 rounded-lg">
                  <Text className="font-lato-bold text-sm text-gray-800 mb-2">
                    Acknowledgment
                  </Text>
                  <Text className="font-lato text-xs text-gray-700 leading-5">
                    BY USING ESTATE LINK SERVICES, YOU ACKNOWLEDGE THAT YOU HAVE READ AND UNDERSTOOD THIS PRIVACY POLICY AND CONSENT TO THE COLLECTION, USE, AND DISCLOSURE OF YOUR INFORMATION AS DESCRIBED HEREIN.
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

