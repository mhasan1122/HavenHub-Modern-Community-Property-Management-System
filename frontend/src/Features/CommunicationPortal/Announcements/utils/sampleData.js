// Sample data for testing announcements with attachments
export const createSampleAnnouncement = () => {
  // Create sample base64 image data (different colored squares for testing slider)
  const redSquare = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8/5+hnoEIwDiqkL4KAcT9GO2HzqI8AAAAAElFTkSuQmCC';
  const greenSquare = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mNk+M9Qz0AEYBxVSF+FAAhKBQXYaP9bAAAAAElFTkSuQmCC';
  const blueSquare = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mNkYGCop6cHYBxVSF+FAAgKBQWlWkvOAAAAAElFTkSuQmCC';

  const sampleAnnouncement = {
    id: Date.now().toString(),
    title: 'Sports Event Announcement',
    description: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry\'s standard dummy text ever since the 1500s.',
    author: 'Rusaf',
    creatorName: 'Rusaf',
    postAs: 'Creator',
    priority: 'high',
    label: 'Sports',
    startDate: '2024-12-01',
    startTime: '10:00',
    endDate: '2024-12-31',
    endTime: '18:00',
    status: 'ongoing',
    createdAt: new Date().toISOString(),
    views: 30,
    pinned: false,
    attachments: [
      {
        url: redSquare,
        base64: redSquare,
        name: 'sports-banner.png',
        type: 'image/png'
      },
      {
        url: greenSquare,
        base64: greenSquare,
        name: 'event-details.jpg',
        type: 'image/jpeg'
      },
      {
        url: blueSquare,
        base64: blueSquare,
        name: 'schedule.png',
        type: 'image/png'
      }
    ],
    towers: ['Tower A', 'Tower B'],
    units: ['Unit 101', 'Unit 102']
  };

  return sampleAnnouncement;
};

export const addSampleAnnouncementToStorage = () => {
  const existingAnnouncements = JSON.parse(localStorage.getItem('announcements') || '[]');
  const sampleAnnouncement = createSampleAnnouncement();

  // Check if sample already exists
  const exists = existingAnnouncements.some(ann => ann.title === sampleAnnouncement.title);

  if (!exists) {
    const updatedAnnouncements = [...existingAnnouncements, sampleAnnouncement];
    localStorage.setItem('announcements', JSON.stringify(updatedAnnouncements));
    console.log('Sample announcement with attachments added to localStorage');
  }

  return sampleAnnouncement;
};
