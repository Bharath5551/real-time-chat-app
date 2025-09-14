public class WordCount {
    public static void main(String[] args) {
        if (args.length == 0) {
            System.out.println(0);
            return;
        }
        String message = args[0];
        int count = message.trim().split("\\s+").length;
        System.out.println(count);
    }
}
