import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface PriorityOption {
  value: string;
  label: string;
  color: string;
  icon: string;
}

interface PriorityDropdownProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const { width } = Dimensions.get('window');

const priorityOptions: PriorityOption[] = [
  {
    value: 'low',
    label: 'Low Priority',
    color: '#10b981',
    icon: 'checkmark-circle',
  },
  {
    value: 'medium',
    label: 'Medium Priority',
    color: '#f59e0b',
    icon: 'information-circle',
  },
  {
    value: 'high',
    label: 'High Priority',
    color: '#ef4444',
    icon: 'alert-circle',
  },
];

export default function PriorityDropdown({
  value,
  onValueChange,
  disabled = false,
  placeholder = 'Select Priority',
}: PriorityDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = priorityOptions.find(option => option.value === value);

  const handleSelect = (priority: string) => {
    onValueChange(priority);
    setIsOpen(false);
  };

  const getPriorityColor = (priority: string) => {
    const option = priorityOptions.find(opt => opt.value === priority);
    return option ? option.color : '#6b7280';
  };

  const getPriorityIcon = (priority: string) => {
    const option = priorityOptions.find(opt => opt.value === priority);
    return option ? option.icon : 'help-circle';
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.trigger,
          disabled && styles.disabled,
          value && styles.hasValue,
        ]}
        onPress={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {value ? (
          <View style={styles.selectedValue}>
            <View
              style={[
                styles.priorityIndicator,
                { backgroundColor: getPriorityColor(value) },
              ]}
            >
              <Ionicons
                name={getPriorityIcon(value) as any}
                size={16}
                color="white"
              />
            </View>
            <Text style={styles.selectedText}>
              {selectedOption?.label || value}
            </Text>
          </View>
        ) : (
          <Text style={styles.placeholder}>{placeholder}</Text>
        )}
        <Ionicons
          name="chevron-down"
          size={20}
          color={disabled ? '#9ca3af' : '#6b7280'}
        />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.dropdown}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>Select Priority</Text>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            {priorityOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.option,
                  value === option.value && styles.selectedOption,
                ]}
                onPress={() => handleSelect(option.value)}
              >
                <View
                  style={[
                    styles.optionIndicator,
                    { backgroundColor: option.color },
                  ]}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={16}
                    color="white"
                  />
                </View>
                <Text
                  style={[
                    styles.optionText,
                    value === option.value && styles.selectedOptionText,
                  ]}
                >
                  {option.label}
                </Text>
                {value === option.value && (
                  <Ionicons name="checkmark" size={20} color={option.color} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 48,
  },
  disabled: {
    opacity: 0.5,
    backgroundColor: '#f3f4f6',
  },
  hasValue: {
    backgroundColor: 'white',
    borderColor: '#d1d5db',
  },
  selectedValue: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  priorityIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  selectedText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  placeholder: {
    fontSize: 16,
    color: '#9ca3af',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdown: {
    width: width * 0.8,
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  selectedOption: {
    backgroundColor: '#f0f9ff',
  },
  optionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
  },
  selectedOptionText: {
    fontWeight: '600',
    color: '#111827',
  },
});
