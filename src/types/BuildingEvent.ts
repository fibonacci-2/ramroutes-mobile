export type BuildingEvent = {
  id: string;
  buildingId: string;
  buildingName: string;
  eventName: string;
  description?: string;
  date?: string;
  eventType?: string;
  recurrenceData?: string;
  attendees?: string[];
  interestedUsers?: string[];
  imageUrl?: string;
  tags?: string[];
  gainedCoins?: number;
  gainedKb?: number;
};
