const dailyQuotes = [
  ["Không phải vì mọi thứ khó mà ta không dám; vì ta không dám nên mọi thứ khó.", "Seneca"],
  ["Thành công là tổng của những nỗ lực nhỏ, lặp lại mỗi ngày.", "Robert Collier"],
  ["Điều quan trọng không phải tốc độ, mà là không dừng lại.", "Khuyết danh"],
  ["Kỷ luật là cây cầu nối mục tiêu và thành tựu.", "Jim Rohn"],
  ["Tin rằng bạn có thể, và bạn đã đi được nửa đường.", "Theodore Roosevelt"],
  ["Cách duy nhất để làm tốt công việc là yêu điều bạn làm.", "Steve Jobs"],
  ["Không có con đường tắt đến bất kỳ nơi nào đáng đến.", "Beverly Sills"],
  ["Mỗi ngày là một cơ hội mới để trở nên tốt hơn hôm qua.", "Khuyết danh"],
  ["Khó khăn thường chuẩn bị người bình thường cho một số phận phi thường.", "C.S. Lewis"],
  ["Bạn không cần thấy cả cầu thang; chỉ cần bước bước đầu tiên.", "Martin Luther King Jr."],
  ["Kiên trì là làm tiếp dù bạn chưa thấy kết quả.", "Khuyết danh"],
  ["Học tập không làm cạn trí tuệ; nó thắp sáng trí tuệ.", "Leonardo da Vinci"],
  ["Sai lầm là bằng chứng bạn đang cố gắng.", "Khuyết danh"],
  ["Năng lực đến từ việc làm đi làm lại điều đúng.", "Aristotle"],
  ["Đừng đếm ngày; hãy làm cho ngày tháng có ý nghĩa.", "Muhammad Ali"],
  ["Sự xuất sắc là thói quen, không phải một hành động.", "Aristotle"],
  ["Không ai có thể quay lại để bắt đầu lại, nhưng ai cũng có thể bắt đầu hôm nay.", "Carl Bard"],
  ["Hôm nay khó, ngày mai sẽ khó hơn, nhưng ngày kia sẽ rực rỡ.", "Jack Ma"],
  ["Chỉ cần tiến lên, dù chậm đến đâu.", "Khuyết danh"],
  ["Người chiến thắng không bao giờ bỏ cuộc; người bỏ cuộc không bao giờ chiến thắng.", "Vince Lombardi"],
  ["Tương lai phụ thuộc vào điều bạn làm hôm nay.", "Mahatma Gandhi"],
  ["Mỗi nỗ lực đều đang xây nên con người bạn sẽ trở thành.", "Khuyết danh"],
  ["Không có gì thay thế được sự chăm chỉ.", "Thomas Edison"],
  ["Can đảm không phải là không sợ, mà là tiến bước dù đang sợ.", "Nelson Mandela"],
  ["Thành công bắt đầu từ quyết định thử thêm một lần nữa.", "Khuyết danh"],
  ["Tâm trí kiên định có thể biến trở ngại thành cơ hội.", "Marcus Aurelius"],
  ["Bạn mạnh hơn những gì bạn nghĩ và bền bỉ hơn những gì bạn tưởng.", "Khuyết danh"],
  ["Một giờ học hôm nay có thể thay đổi cả ngày mai.", "Khuyết danh"],
  ["Không cần hoàn hảo; chỉ cần tiến bộ.", "Khuyết danh"],
  ["Người biết kiên nhẫn sẽ nhận được điều tốt đẹp.", "Benjamin Franklin"],
  ["Tập trung vào bước tiếp theo, không phải toàn bộ con đường.", "Khuyết danh"],
  ["Mục tiêu lớn được hoàn thành từ những việc nhỏ được làm tốt.", "Khuyết danh"],
  ["Đừng để điều bạn không thể làm ngăn cản điều bạn có thể làm.", "John Wooden"],
  ["Mỗi trang sách là một bước gần hơn tới phiên bản giỏi hơn của bạn.", "Khuyết danh"],
  ["Người thành công làm điều người khác không muốn làm.", "Albert E. N. Gray"],
  ["Không có đêm nào đủ dài để ngăn bình minh.", "Victor Hugo"],
  ["Khi mệt, hãy nghỉ; đừng bỏ cuộc.", "Khuyết danh"],
  ["Hành trình vạn dặm bắt đầu từ một bước chân.", "Lão Tử"],
  ["Tri thức là sức mạnh.", "Francis Bacon"],
  ["Bạn không thua khi chậm; bạn chỉ thua khi dừng lại.", "Khuyết danh"],
  ["Hãy làm điều hôm nay để ngày mai cảm ơn bạn.", "Khuyết danh"],
  ["Sự chuẩn bị hôm nay tạo nên sự tự tin ngày mai.", "Khuyết danh"],
  ["Mỗi lần ôn lại là một lần trí nhớ được củng cố.", "Khuyết danh"],
  ["Điều tuyệt vời cần thời gian và sự bền bỉ.", "Khuyết danh"],
  ["Không ai giỏi ngay từ đầu; mọi người giỏi lên nhờ luyện tập.", "Khuyết danh"],
  ["Hãy để mục tiêu lớn hơn nỗi sợ của bạn.", "Robert Kiyosaki"],
  ["Bạn càng luyện tập, cơ hội càng có vẻ giống may mắn.", "Seneca"],
  ["Kết quả tốt bắt đầu từ một quyết định nghiêm túc.", "Khuyết danh"],
  ["Mỗi ngày học thêm một chút là mỗi ngày tiến gần ước mơ hơn.", "Khuyết danh"],
  ["Bạn đã đi xa hơn ngày hôm qua; hãy tiếp tục.", "Khuyết danh"],
] as const;

export function getDailyQuote() {
  const now = new Date();
  const start = Date.UTC(now.getFullYear(), 0, 0);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfYear = Math.floor((today - start) / 86_400_000);
  return dailyQuotes[dayOfYear % dailyQuotes.length];
}

function Footer() {
  const [quote, author] = getDailyQuote();

  return (
    <footer className="relative z-10 mx-auto mt-6 w-full max-w-[1900px] clear-both px-5 pb-5 pt-2 text-center sm:px-6 xl:px-8 lg:pl-72">
      <div className="rounded-2xl border border-rose-100/80 bg-white/55 px-5 py-4 shadow-sm backdrop-blur-sm sm:px-8">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-rose-400">Lời nhắc hôm nay</p>
        <blockquote className="daily-quote daily-quote--shiny mx-auto max-w-3xl text-base font-medium italic leading-6">“{quote}”</blockquote>
        <cite className="mt-2 block text-sm font-semibold italic text-slate-500">— {author}</cite>
      </div>
      <p className="mt-3 text-xs text-slate-400">© 2026 StudyHub · <span className="font-semibold tracking-wide text-slate-500">bdtk v1.0.0</span></p>
    </footer>
  );
}

export default Footer;
