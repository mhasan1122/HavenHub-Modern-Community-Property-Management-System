export const getMemberFromLocalStorage = () => {
    try {
      const storedMember = localStorage.getItem("member");
      if (!storedMember) return null;
      const parsedMember = JSON.parse(storedMember);
  
      return {
        full_name: parsedMember.full_name || "Member Name",
        role: parsedMember.member_roles?.[0]?.role_name || "Member Role",
        id: parsedMember.id || "N/A",
        photo: parsedMember.photo_low_quality
          ? `http://127.0.0.1:8000${parsedMember.photo_low_quality}`
          : "/admin.jpg",
      };
    } catch (error) {
      console.error("Error fetching member from localStorage:", error);
      return null;
    }
  };
  