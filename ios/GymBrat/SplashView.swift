import UIKit

/// Natywny splash marki podczas pierwszego ładowania WebView.
final class SplashView: UIView {
    private let titleLabel = UILabel()
    private let subtitleLabel = UILabel()
    private let spinner = UIActivityIndicatorView(style: .large)

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = Theme.background
        isAccessibilityElement = false

        titleLabel.text = "GymBrat"
        titleLabel.font = UIFont.systemFont(ofSize: 42, weight: .black)
        titleLabel.textColor = Theme.gold
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        subtitleLabel.text = "Centrum treningowe"
        subtitleLabel.font = UIFont.systemFont(ofSize: 15, weight: .medium)
        subtitleLabel.textColor = Theme.textSecondary
        subtitleLabel.textAlignment = .center
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false

        spinner.color = Theme.gold
        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.startAnimating()

        addSubview(titleLabel)
        addSubview(subtitleLabel)
        addSubview(spinner)

        NSLayoutConstraint.activate([
            titleLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: centerYAnchor, constant: -28),
            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 8),
            subtitleLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            spinner.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 28),
            spinner.centerXAnchor.constraint(equalTo: centerXAnchor),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func dismiss(animated: Bool, completion: (() -> Void)? = nil) {
        let work = {
            self.removeFromSuperview()
            completion?()
        }
        guard animated else {
            work()
            return
        }
        UIView.animate(withDuration: 0.28, animations: {
            self.alpha = 0
        }, completion: { _ in work() })
    }
}
