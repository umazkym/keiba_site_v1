export const Footer = () => {
    return (
      <footer className="bg-gray-200 text-center py-4 mt-8">
        <div className="container mx-auto px-4">
          <p className="text-sm text-gray-600">
            &copy; {new Date().getFullYear()} Keiba AI Site. All Rights Reserved.
          </p>
        </div>
      </footer>
    );
};