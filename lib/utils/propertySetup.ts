import { Linking } from 'react-native';
import type { Property } from '@/types';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_APP_URL ?? 'https://www.assetbrain.app';

/**
 * A property is "setup complete" once the web wizard has populated
 * financial depth (mortgage data or NOI). Properties quick-added on
 * mobile won't have these fields yet.
 */
export function isPropertySetupComplete(property: Pick<Property, 'monthly_debt_service' | 'annual_noi'>): boolean {
  return property.monthly_debt_service != null || property.annual_noi != null;
}

export function openPropertyOnWeb(propertyId: string): void {
  Linking.openURL(`${WEB_URL}/properties/${propertyId}`);
}

export function openWebApp(): void {
  Linking.openURL(WEB_URL);
}
